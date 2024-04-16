import BotWhatsapp from '@bot-whatsapp/bot';
import { ChatCompletionMessageParam } from 'openai/resources';
import { run } from 'src/services/openai';
import { getPromptGeneral, getPromptNombre, getPromptRegion, getPromptConoce, getPromptAppInstalada, getPromptAgencia, getPromptEdad, getPromptDudas } from "../services/openai/prompt";

var users = {};

/**
 * Un flujo conversacion que es por defecto cuando no se contiene palabras claves en otros flujos
 */
export default BotWhatsapp.addKeyword(BotWhatsapp.EVENTS.WELCOME)
    .addAction(async (ctx, { flowDynamic, state, gotoFlow }) => {
        try{
            //console.log('ctx', ctx, JSON.stringify(ctx));
            
            const newHistory = (state.getMyState()?.history ?? []) as ChatCompletionMessageParam[];
                
            if (users[ctx.from]?.force) {
                newHistory.push({
                    role: 'assistant',
                    content: '¿Cuál es tu nombre?'
                });
                await state.update({history: newHistory});
                users[ctx.from].force = false;
            } else if (ctx.from == '573184216132') {
                const number = ctx.body.substring(2);
                switch (ctx.body[0]) {
                    case 'a': // Add
                        users[number] = {force: true, isFBAds: true, step: 2}
                        console.log('Added', number);
                        await flowDynamic('Added: ' + number);
                        return;
                    case 'e': // Exclude
                        if (users[number]) {
                            users[number].exclude = true;
                            await flowDynamic('Excluded: ' + number);
                        } else {
                            await flowDynamic('User does not exist: ' + number);
                        }
                        return;
                }
            }

            if (users[ctx.from]?.isTyping) {
                users[ctx.from].ms = 10000 + ctx.body.length * 500;
                console.log('Agregado', ctx.from, ctx.body);
                users[ctx.from].message += '.\n' + ctx.body;
            } else {
                if (users[ctx.from])
                    users[ctx.from].isTyping = true;
                else
                    users[ctx.from] = {isTyping: true};
            
                users[ctx.from].message = ctx.body;
                users[ctx.from].ms = 10000 + (users[ctx.from].message.length * 500);
                let ms = 0;
                while (users[ctx.from].ms > 0) {
                    ms = users[ctx.from].ms;
                    console.log('Esperando', ctx.from, ctx.body, ms);
                    users[ctx.from].ms = 0;
                    await new Promise(resolve => setTimeout(resolve, ms)); // Se espera, por si el usuario escribe algo más.
                }

                console.log('Inició flujo');
                if (newHistory.length <= 20) {
                    let name = ctx?.pushName ?? '';
                    if (users[ctx.from] && users[ctx.from].name)
                        name = users[ctx.from].name;

                    //console.log(`[HISTORY]:`,newHistory)

                    newHistory.push({
                        role: 'user',
                        content: users[ctx.from].message
                    });

                    const keyWords = [
                        'quisiera contactar una agencia',
                        'quisiera iniciar como emisor'
                    ];

                    const existKeyWords = () => {
                        const text = newHistory[0].content;
                        for (let i = 0; i < keyWords.length; i++) {
                            //console.log(text, keyWords[i], String(text).includes(keyWords[i]))
                            if (String(text).includes(keyWords[i])) 
                                return true;
                        }
                        return false;
                    }

                    if (!users[ctx.from]?.isFBAds) {
                        let object = JSON.parse(JSON.stringify(ctx));
                        console.log(JSON.stringify(ctx));
                        if (object.message && object.message.extendedTextMessage && object.message.extendedTextMessage.contextInfo && object.message.extendedTextMessage.contextInfo.conversionSource && object.message.extendedTextMessage.contextInfo.conversionSource == "FB_Ads") {
                            if (users[ctx.from])
                                users[ctx.from].isFBAds = true;
                            else
                                users[ctx.from] = {isFBAds: true};
                        }
                    }

                    if ((existKeyWords() || users[ctx.from]?.isFBAds) && (! users[ctx.from]?.exclude)) {
                        console.log('user:', users[ctx.from].message);

                        let largeResponse = '', chunks = [], hayDudas = '', contador = 0;

                        if (users[ctx.from].step > 3) {
                            do {
                                hayDudas = await run(getPromptDudas(users[ctx.from].message), []);
                                hayDudas = hayDudas.toUpperCase();
                                contador ++;
                                console.log(`HAY DUDAS:`, hayDudas);
                            } while ((((!hayDudas.includes('YES')) && (!hayDudas.includes('NO'))) || hayDudas.length > 5) && contador < 3 );

                            if (contador == 3) {
                                users[ctx.from].step = 999;
                                users[ctx.from].exclude = true;
                                users[ctx.from].isFBAds = false;
                                console.log('Error: Se transfiere a un asesor.');
                                return;
                            }
                        }

                        if (users[ctx.from] && ((!users[ctx.from].step) || users[ctx.from].step < 7) && (!hayDudas.includes('YES'))) {
                            console.log('validando');
                            if (!users[ctx.from]) return
                            console.log('User validate:', users[ctx.from]);
                            let response = '';
                    
                            if (users[ctx.from].step) {
                                switch (users[ctx.from].step) {
                                    case 2:
                                        if (!users[ctx.from].name) {
                                            response = await run(getPromptNombre(), newHistory)
                                            console.log(`NOMBRE:`, response)
                                
                                            if(!response.toUpperCase().includes('UNKNOWN')) {
                                                users[ctx.from].name = response?.split(" ")[0];
                                            }
                                        }
                                        break;
                                    case 3:
                                        if (!users[ctx.from].region) {
                                            response = await run(getPromptRegion(), newHistory)
                                            console.log(`REGIÓN:`, response.toUpperCase())
                                
                                            if(!response.toUpperCase().includes('UNKNOWN')) {
                                                users[ctx.from].region = response.toUpperCase();
                                            }
                                        }
                                        break;
                                    case 4:
                                        if (!users[ctx.from].level) {
                                            response = await run(getPromptConoce(), newHistory)
                                            console.log(`CONOCE:`, response.toUpperCase())
                                
                                            if(response.toUpperCase().includes('YES')) {
                                                users[ctx.from].level = 2;
                                                users[ctx.from].step--;
                                            } else if (response.toUpperCase().includes('NO')) {
                                                users[ctx.from].level = 1;
                                            }
                                        } else if (users[ctx.from].level == 2) {
                                            response = await run(getPromptAppInstalada(), newHistory)
                                            console.log(`APP INSTALADA:`, response.toUpperCase())
                                
                                            if(response.toUpperCase().includes('YES')) {
                                                users[ctx.from].level = 4;
                                                users[ctx.from].step--;
                                            } else if (response.toUpperCase().includes('NO')) {
                                                users[ctx.from].level = 3;
                                            }
                                        } else if (users[ctx.from].level == 4) {
                                            response = await run(getPromptAgencia(), newHistory);
                                            console.log(`TIENE AGENCIA:`, response.toUpperCase());
                                
                                            if(response.toUpperCase().includes('YES')) {
                                                users[ctx.from].level = 6;
                                                users[ctx.from].step = 999;
                                                users[ctx.from].exclude = true;
                                                users[ctx.from].isFBAds = false;
                                                console.log('Se transfiere a un asesor.');
                                                largeResponse = users[ctx.from].name + ', por politicas de Bigo Live si ya estás con una agencia no sería posible realizar el proceso con una nueva. Si aún así deseas intentarlo por favor regálame una captura de tu perfil actual de Bigo Live y el nombre de tu agencia para validar.';
                                                chunks.push(users[ctx.from].name + ', por politicas de Bigo Live si ya estás con una agencia no sería posible realizar el proceso con una nueva.');
                                                chunks.push('Si aún así deseas intentarlo por favor regálame una captura de tu perfil actual de Bigo Live y el nombre de tu agencia para validar.');
                                            } else if (response.toUpperCase().includes('NO')) {
                                                users[ctx.from].level = 5;
                                            }
                                        }
                                        break;
                                    case 6:
                                        response = await run(getPromptEdad(), newHistory);
                                        console.log(`MAYOR DE EDAD:`, response.toUpperCase());
                                        if(response.toUpperCase().includes('NO')) {
                                            users[ctx.from].step = 999;
                                            users[ctx.from].exclude = true;
                                            users[ctx.from].isFBAds = false;
                                            console.log('Se transfiere a un asesor.');
                                            largeResponse = users[ctx.from].name + ', lamentablemente para ser emisor oficial de Bigo Live debes ser mayor de edad. 🥺 En este caso no sería posible.';
                                            chunks.push(largeResponse);
                                        }
                                        break;
                                }
                            } else {
                                users[ctx.from].step = 1;
                            }

                            if ((!users[ctx.from].isFBAds) && (!users[ctx.from].level)) users[ctx.from].level = 2;
                            console.log('User:', users[ctx.from]);
                            
                            switch (users[ctx.from].step) {
                                case 1:
                                    users[ctx.from].step++;
                                    if (!users[ctx.from].name) {
                                        largeResponse = '¡Hola! gracias por contactarnos, yo soy Andy de *Bigoland*, ¿podrías decirme tu nombre?';
                                        chunks.push(largeResponse);
                                    }
                                    break;
                                case 2:
                                    users[ctx.from].step++;
                                    if (!users[ctx.from].region) {
                                        largeResponse = '¡Perfecto, ' + users[ctx.from].name + '! 🎉 Para guiarte adecuadamente, ¿me podrías decir de qué país nos escribes?';
                                        chunks.push(largeResponse);
                                    }
                                    break;
                                case 3:
                                    users[ctx.from].step++;
                                    if (!users[ctx.from].level) {
                                        largeResponse = `¡Genial, ${users[ctx.from].name}! 🙌🏻 ¿Habías escuchado antes sobre BIGO LIVE? 😄`;
                                        chunks.push(`¡Genial, ${users[ctx.from].name}! 🙌🏻 Ya te explico.`);
                                        chunks.push('En *Bigoland*, trabajamos con una aplicación de transmisiones en vivo llamada BIGO LIVE, donde puedes ganar dinero mientras te diviertes. Si te gusta *conocer* nuevas personas y tienes un gran *carisma*, esta app es perfecta para ti.');
                                        chunks.push('Así es como funciona:\n' +
                                            '📹 Realizas transmisiones en vivo diarias de 1-2 horas hasta completar un total de *44 horas al mes*.\n' +
                                            '🎁 Recibes regalos de los usuarios durante tus transmisiones, los cuales tienen un valor en *semillas*, la moneda interna de la aplicación.\n' +
                                            '💰 Puedes cambiar estas semillas por *dinero* real.\n' +
                                            '🎉 Obtienes un *pago* extra de Bigo Live por alcanzar las 44 horas de transmisión y una meta de semillas.\n' +
                                            '💸 ¡Puedes ganar entre $100 y $5,000 *dólares al mes*, dependiendo de tu rendimiento y compromiso!\n' +
                                            '🚫 Lo mejor de todo, ¡*no* necesitas hacer inversiones ni tienes que preocuparte por cláusulas de permanencia!');
                    
                                        chunks.push('¿Habías escuchado antes sobre BIGO LIVE ' + users[ctx.from].name + '? 😄');
                                    } else if (users[ctx.from].level == 2) {
                                        largeResponse = 'Perfecto, ' + users[ctx.from].name + ' 🌟 ¿tienes instalada la app de BIGO LIVE en tu teléfono?';
                                        chunks.push(largeResponse);
                                    } else if (users[ctx.from].level == 4) {
                                        largeResponse = '¡Genial! 📱 Ahora dime, ¿has tenido contacto con alguna agencia para convertirte en emisor oficial de BIGO LIVE?';
                                        chunks.push(largeResponse);
                                    } 
                                    break;
                                case 4:
                                    users[ctx.from].step++;
                                    largeResponse = `Listo, ${users[ctx.from].name} 🙌🏻 Entonces te explicaré el funcionamiento general de Bigo Live:
Bigo Live está enfocado en las transmisiones en vivo de carisma o talentos. 💃🏻 En estas transmisiones, puedes hablar de lo que quieras o hacer juegos, ¡lo que se te ocurra! 🥳
Durante estas transmisiones, los usuarios tienen la opción de enviarte regalitos 🎁 que te otorgan semillas, la moneda interna de la app. Y lo mejor es que ¡puedes retirarlas en dólares! (210 semillas = $1). 💰
Pero espera, ¡hay más! Bigo Live también te ofrece un pago de bonificación mensual, que supera el 100% de la meta alcanzada. Si cumples con un mínimo de 44 horas de transmisión y 10,000 semillas, ¡puedes recibir este pago adicional! Para ello, necesitas ser una emisora oficial de Bigo Live. 💸
Puedes consultar la tabla de metas para el pago de bonificaciones en este enlace: https://bigoland.co/remuneracion-emisores-en-latinoamerica/
¿De esta parte tienes alguna duda? 😄
                                    `;
                                    chunks.push(`Listo, ${users[ctx.from].name}! 🙌🏻 Entonces te explicaré el funcionamiento general de Bigo Live.`);
                                    chunks.push('Bigo Live está enfocado en las *transmisiones en vivo* de carisma o talentos. 💃🏻 En estas transmisiones, puedes hablar de lo que quieras o hacer juegos, ¡lo que se te ocurra! 🥳');
                                    chunks.push('Durante estas transmisiones, los usuarios tienen la opción de enviarte *regalitos* 🎁 que te otorgan semillas, la moneda interna de la app. Y lo mejor es que ¡puedes retirarlas en *dólares*! (210 semillas = $1). 💰');
                                    chunks.push('Pero espera, ¡hay más! Bigo Live también te ofrece un pago de *bonificación mensual*, que suele superar el 100% de la meta alcanzada. Si cumples con un mínimo de *44 horas* de transmisión y *10,000 semillas*, ¡puedes recibir este pago adicional! Para ello, necesitas ser una *emisora oficial* de Bigo Live. 💸');
                                    chunks.push('Puedes consultar las condiciones y la tabla de metas para el pago de bonificaciones en este enlace: https://bigoland.co/remuneracion-emisores-en-latinoamerica/');                
                                    chunks.push('¿De esta parte tienes alguna duda ' + users[ctx.from].name + '? 😄');
                                    break;
                                case 5:
                                    users[ctx.from].step++;
                                    largeResponse = `¡Súper, ${users[ctx.from].name}! 🙌🏻 Ahora te explico, para ser emisora oficial debes ser mayor de edad, ¿tú qué edad tienes?`;
                                    chunks.push(`¡Súper, ${users[ctx.from].name}! 🙌🏻 Ahora te explico, para ser emisora oficial debes cumplir los siguientes requisitos:
🔞 Ser mayor de edad.
🛜 Contar con buena calidad de internet. 
📱 Tener una buena calidad de transmisión, en cuanto a imagen y sonido. 
🤩 Por último y más importante, mucha actitud y carisma.
                                    `);
                                    chunks.push('¿Tú que edad tienes ' + users[ctx.from].name + '?');
                                    break;
                                case 6:
                                    users[ctx.from].step++;

                                    largeResponse = `Perfecto, ${users[ctx.from].name}, para ser emisora oficial debemos hacer el proceso con una agencia, en este caso la agencia *Ravinger* nos ayuda a verificar tu cuenta oficialmente con Bigo Live.\n`;

                                    chunks.push(`Perfecto, ${users[ctx.from].name}, para ser emisora oficial debemos hacer el proceso con una agencia, en este caso la agencia *Ravinger* nos ayuda a verificar tu cuenta oficialmente con Bigo Live.`);

                                    let step = 1, steps = '';
                                    if (users[ctx.from].level < 4>) {
                                        steps += step + '. *Descarga* la app de Bigo Live desde el siguiente enlace: https://bigoland.co/descargar-bigo-live. Ingresas y te registras con tu número de celular.\n';
                                        step ++;
                                    }
                                    steps += step + '. Acepta la invitación a la *agencia* desde el siguiente enlace: https://bigoland.co/agencia.\n';
                                    step ++;
                                    steps += step + '. Realiza un video en modo selfie de medio cuerpo y con buena iluminación. Debes decir tu nombre, edad, país de residencia y que quieres unirte a la agencia *Ravinger* y enviarme el video por este medio.\n';
                                    step ++;
                                    steps += step + '. Espera a ser aprobada para recibir el *contrato*, la agencia se contactará contigo para revisarlo. \n';
                                
                                    largeResponse += 'Para verificar tu cuenta e iniciar como emisora oficial de Bigo Live debes seguir los siguientes pasos:\n\n' + steps;

                                    chunks.push('Para verificar tu cuenta e iniciar como emisora oficial de Bigo Live debes seguir los siguientes pasos:\n\n' + steps);

                                    chunks.push('Para una guía más detallada sigue el siguiente enlace: https://bigoland.co/proceso-para-unirse-a-una-agencia-de-bigo-live/');
                                    chunks.push('Cualquier duda durante el proceso me puedes escribir, estaré aquí para ayudarte.');
                                    break;
                                /*case 7:
                                    users[ctx.from].step++;
                                    - Configurar el perfil: Editarlo y poner una foto de perfil y un nombre de usuario si aún nolo ha hecho.
                                    largeResponse = `¡Súper, ${users[ctx.from].name}! 🙌🏻 Ahora te explico, para ser emisora oficial debes ser mayor de edad, ¿tú qué edad tienes?`;
                                    chunks.push(`¡Súper, ${users[ctx.from].name}! 🙌🏻 Ahora te explico, para ser emisora oficial debes cumplir los siguientes requisitos:
                                    🔞 Ser mayor de edad.
                                    🛜 Contar con buena calidad de internet. 
                                    📱 Tener una buena calidad de transmisión, en cuanto a imagen y sonido. 
                                    🤩 Por último y más importante, mucha actitud y carisma.
                                    `);
                                    chunks.push('¿Tú que edad tienes ' + users[ctx.from].name + '?');
                                    break;
                                case 8:
                                    users[ctx.from].step++;
                                    - Enviar invitación a la agencia: El usuario debe ingresar al siguiente link y darle aceptar: https://bigoland.co/agencia.
                                    largeResponse = `¡Súper, ${users[ctx.from].name}! 🙌🏻 Ahora te explico, para ser emisora oficial debes ser mayor de edad, ¿tú qué edad tienes?`;
                                    chunks.push(`¡Súper, ${users[ctx.from].name}! 🙌🏻 Ahora te explico, para ser emisora oficial debes cumplir los siguientes requisitos:
                                    🔞 Ser mayor de edad.
                                    🛜 Contar con buena calidad de internet. 
                                    📱 Tener una buena calidad de transmisión, en cuanto a imagen y sonido. 
                                    🤩 Por último y más importante, mucha actitud y carisma.
                                    `);
                                    chunks.push('¿Tú que edad tienes ' + users[ctx.from].name + '?');
                                    break;
                                case 9:
                                    users[ctx.from].step++;
                                    - Hacemos una entrevista: Debe enviar un video por medio de este whatsapp en modo selfie diciendo lo siguiente: Nombre, edad, país donde vive y Al final decir que quiere unirse a la agencia Ravinger.
                                    largeResponse = `¡Súper, ${users[ctx.from].name}! 🙌🏻 Ahora te explico, para ser emisora oficial debes ser mayor de edad, ¿tú qué edad tienes?`;
                                    chunks.push(`¡Súper, ${users[ctx.from].name}! 🙌🏻 Ahora te explico, para ser emisora oficial debes cumplir los siguientes requisitos:
                                    🔞 Ser mayor de edad.
                                    🛜 Contar con buena calidad de internet. 
                                    📱 Tener una buena calidad de transmisión, en cuanto a imagen y sonido. 
                                    🤩 Por último y más importante, mucha actitud y carisma.
                                    `);
                                    chunks.push('¿Tú que edad tienes ' + users[ctx.from].name + '?');
                                    break;
                                case 10:
                                    users[ctx.from].step++;
                                    - Al ser aprobada será contactada por parte de la agencia para realizar la firma del contrato y programar capacitaciones (puede tardar hasta 2 días habiles en ser aprobada).
                                    largeResponse = `¡Súper, ${users[ctx.from].name}! 🙌🏻 Ahora te explico, para ser emisora oficial debes ser mayor de edad, ¿tú qué edad tienes?`;
                                    chunks.push(`¡Súper, ${users[ctx.from].name}! 🙌🏻 Ahora te explico, para ser emisora oficial debes cumplir los siguientes requisitos:
                                    🔞 Ser mayor de edad.
                                    🛜 Contar con buena calidad de internet. 
                                    📱 Tener una buena calidad de transmisión, en cuanto a imagen y sonido. 
                                    🤩 Por último y más importante, mucha actitud y carisma.
                                    `);
                                    chunks.push('¿Tú que edad tienes ' + users[ctx.from].name + '?');
                                    break;*/
                            }
                        } else if((!largeResponse) && hayDudas.includes('YES')) {
                            largeResponse = await run(getPromptGeneral(name), newHistory);
                            chunks = largeResponse.split(/(?<!\d)\.\s+/g);
                        }
                        console.log(`[HISTORY]:`,newHistory);

                        if (largeResponse && largeResponse.toUpperCase().includes('DAME UN MOMENTO')) {
                            if (users[ctx.from].step < 7) {
                                console.log('Se espera a un asesor.');
                            } else {
                                users[ctx.from].exclude = true;
                                users[ctx.from].isFBAds = false;
                                console.log('Se transfiere a un asesor.');
                            }
                        } else {
                            for (const chunk of chunks) {
                                await new Promise(resolve => setTimeout(resolve, chunk.length * 20));
                                await flowDynamic(chunk);
                            }

                            if (largeResponse) {
                                newHistory.push({
                                    role: 'assistant',
                                    content: largeResponse
                                })
                            
                                console.log('assistant:', largeResponse);
                            }
                        }

                        await state.update({history: newHistory});
                    } else {
                        users[ctx.from].exclude = true;
                        users[ctx.from].isFBAds = false;
                    }
                } else {
                    console.log('Superó el máximo history.');
                }
                users[ctx.from].isTyping = false;
            }

        }catch(err){
            users[ctx.from].exclude = true;
            users[ctx.from].isFBAds = false;
            console.log(`[ERROR]:`,err)
        }
        console.log('Final-----------------------------------------------------------------------');
    })