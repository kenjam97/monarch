import path from 'node:path';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { Store } from './store';
import { Importer } from './importer';
import { makeApp } from './app';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),port=Number(process.env.PORT??4317),directory=process.env.MONARCH_DATA??path.join(root,'data');
const store=new Store(directory),importer=new Importer(store),app=makeApp(store,importer,port);
if(process.argv.includes('--dev')){
  // The film is also a standalone document. Its native modules are shared unchanged.
  app.use('/study-film',express.static(path.join(root,'public','study-film')));
  app.get('/study-film.html',(_req,res)=>res.sendFile(path.join(root,'public','study-film.html')));
  const {createServer}=await import('vite');const vite=await createServer({root,server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);
}else {app.use(express.static(path.join(root,'dist')));app.get('/{*path}',(_req,res)=>res.sendFile(path.join(root,'dist','index.html')));}
await importer.start();const server=app.listen(port,'127.0.0.1',()=>console.log(`Monarch ready at http://127.0.0.1:${port}\nData: ${directory}\nInbox: ${importer.inbox}`));
server.on('error',e=>{console.error(e);process.exit(1);});
function stop(){importer.stop();server.close(()=>{store.close();process.exit(0);});}process.on('SIGINT',stop);process.on('SIGTERM',stop);
