import {cpSync,copyFileSync,mkdirSync,existsSync,readdirSync,rmSync,renameSync,readFileSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd(),out=join(root,'dist');
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
for(const f of ['index.html','styles.css','main.js','recognition.js','ui.js','camera.js','training.js','extraction.js','manifest.webmanifest','service-worker.js'])copyFileSync(join(root,f),join(out,f));
cpSync(join(root,'icons'),join(out,'icons'),{recursive:true});
const vendor=join(out,'vendor');mkdirSync(vendor,{recursive:true});
function copy(from,to){if(!existsSync(from))throw Error('Missing package asset: '+from);mkdirSync(dirname(to),{recursive:true});copyFileSync(from,to)}
const nm=join(root,'node_modules');
copy(join(nm,'pdfjs-dist/build/pdf.min.mjs'),join(vendor,'pdf.min.mjs'));
copy(join(nm,'pdfjs-dist/build/pdf.worker.min.mjs'),join(vendor,'pdf.worker.min.mjs'));
copy(join(nm,'tesseract.js/dist/tesseract.min.js'),join(vendor,'tesseract.min.js'));
copy(join(nm,'tesseract.js/dist/worker.min.js'),join(vendor,'tesseract.worker.min.js'));
const core=join(nm,'tesseract.js-core');mkdirSync(join(vendor,'core'),{recursive:true});
for(const f of readdirSync(core).filter(f=>/^tesseract-core-(?:simd-)?lstm\.wasm(?:\.js)?$/.test(f)))copy(join(core,f),join(vendor,'core',f));
copy(join(root,'vendor/lang/eng.traineddata.gz'),join(vendor,'lang/eng.traineddata.gz'));
for(const dir of ['cmaps','standard_fonts'])cpSync(join(nm,'pdfjs-dist',dir),join(vendor,dir),{recursive:true});
function outputFiles(){return readdirSync(out,{recursive:true,withFileTypes:true}).filter(f=>f.isFile()&&f.name!=='service-worker.js').map(f=>join(f.parentPath,f.name));}
// Fresh HTML must never import an older release's cached code or OCR engine.
const version=createHash('sha256');
for(const f of outputFiles().sort())version.update(readFileSync(f));
version.update(readFileSync(join(root,'service-worker.js')));
const hash=version.digest('hex').slice(0,16);
renameSync(vendor,join(out,'vendor-'+hash));
const appAssets=['styles.css','main.js','recognition.js','ui.js','camera.js','training.js','extraction.js','manifest.webmanifest'];
for(const file of ['index.html','main.js','training.js']){
  let source=readFileSync(join(out,file),'utf8').replaceAll('./vendor/','./vendor-'+hash+'/');
  for(const asset of appAssets){
    for(const quote of ['\"',"'"])source=source.replaceAll('./'+asset+quote,'./'+asset+'?build='+hash+quote);
  }
  writeFileSync(join(out,file),source);
}
const precache=['./',...outputFiles().map(f=>'./'+f.slice(out.length+1).replaceAll('\\','/')),...appAssets.map(f=>'./'+f+'?build='+hash)];
writeFileSync(join(out,'precache.json'),JSON.stringify(precache));
const sw=readFileSync(join(out,'service-worker.js'),'utf8').replace('__BUILD_HASH__',hash);
writeFileSync(join(out,'service-worker.js'),sw);
console.log('Built local-only offline site in dist/ ('+precache.length+' app assets).');
