import {readFile,writeFile,mkdir,rm,copyFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
for(const name of ['app.js','style.css','favicon.svg','data.json'])await copyFile('ui/'+name,'dist/'+name);
const data=await readFile('ui/data.json','utf8');const html=(await readFile('ui/index.html','utf8')).replace('<script src="app.js"></script>','<script id="initial-data" type="application/json">'+data.replaceAll('<','\\u003c')+'</script><script src="app.js"></script>');await writeFile('dist/index.html',html);await writeFile('dist/.nojekyll','');console.log('Built Pages assets');
