import BotWhatsapp from '@bot-whatsapp/bot';

/**
 * Un flujo conversacion que transfiere con un asesor
 */
export default BotWhatsapp.addKeyword(BotWhatsapp.EVENTS.ACTION)
    .addAnswer('En un momento un asesor estará contigo para ayudarte. 🙂')

