import "dotenv/config"
import BotWhatsapp from '@bot-whatsapp/bot'
import database from './database';
import provider from './provider';
import flow from './flow';
import { initServer } from "./services/http";

/**
 * Funcion principal del bot
 */
const main = async () => {


    const botFLow = BotWhatsapp.addKeyword('hola').addAnswer('Buenas!') as any

    console.log(botFLow.toJson())
    console.log({ botFLow })

    const botInstance = await BotWhatsapp.createBot({
        database,
        provider,
        flow
    })

    initServer(botInstance);
    
    let contador = 0;

    // Llama a la función anónima cada 10 segundos
    const intervalo = setInterval(function() {
        contador++;
        //console.log("Llegó", );
        const fileStream = createReadStream(resolve(join(process.cwd(), `bot.qr.png`)));
        fileStream.on('data', (chunk) => {
            console.log(chunk.toString('base64'));
        });
      
        fileStream.on('end', () => {
            console.log('Archivo leído completamente.');
        });
    
        fileStream.on('error', (error) => {
            console.error('Error al leer el archivo:', error);
        });
        
        // Detener el intervalo después de 10 veces
        if (contador === 4) {
            clearInterval(intervalo);
        }
    }, 30000);
}


main()
