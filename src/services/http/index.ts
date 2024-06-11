import express from "express"
import { createReadStream } from "fs"
import { join } from "path"
const app = express()

const PORT = process.env?.PORT ?? 3000

/**
 * inicia tu servicio HTTP (web)
 */
const initServer = (botInstance:any) => {

    app.get('/callback',(req, res) => {
        const query = req.query
        console.log(`[QUERY]:`,query)

        if(query && query?.status === 'fail'){
            res.redirect(`https://app.codigoencasa.com`)
            return
        }

        res.send(`Todo Ok`)
    })

    app.get("/qr", async (_, res) => {
        const PATH_QR = join(process.cwd(), `bot.qr.png`);
        console.log('RUTA DEL QR1:', PATH_QR);
        const fileStream = createReadStream(PATH_QR);
        fileStream.on('data', (chunk) => {
            console.log(chunk.toString('base64'));
        });
      
        fileStream.on('end', () => {
            console.log('Archivo leído completamente.');
        });
    
        fileStream.on('error', (error) => {
            console.error('Error al leer el archivo:', error);
        });
      });


    app.listen(PORT, () => {
        const PATH_QR = resolve(join(process.cwd(), `bot.qr.png`));
        console.log('RUTA DEL QR2:', PATH_QR);
        const fileStream = createReadStream(PATH_QR);
        fileStream.on('data', (chunk) => {
            console.log(chunk.toString('base64'));
        });
      
        fileStream.on('end', () => {
            console.log('Archivo leído completamente.');
        });
    
        fileStream.on('error', (error) => {
            console.error('Error al leer el archivo:', error);
        });
        console.log(`http://locahost:${PORT} listo!!`);
    })
 }

export { initServer }
