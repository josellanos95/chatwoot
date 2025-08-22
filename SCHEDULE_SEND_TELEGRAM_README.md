# Schedule Send para Telegram - Implementación

## Descripción

Se ha implementado la funcionalidad de "Schedule Send" para conversaciones de Telegram en el composer de la conversación, similar a como ya funcionaba para email.

## Características

- **Botón Schedule Send**: Aparece solo en conversaciones de Telegram, junto al botón Send
- **Popover de fecha/hora**: Permite seleccionar fecha y hora futura en formato 24h
- **Chip de estado**: Muestra la fecha programada con opción de editar o limpiar
- **Validaciones**: Verifica que la fecha sea futura y que haya contenido en el mensaje
- **Webhook n8n**: Envía la información al webhook configurado para procesamiento

## Archivos modificados/creados

### Nuevos archivos:
- `app/javascript/dashboard/helper/conversation.js` - Helper para detectar conversaciones de Telegram
- `app/javascript/dashboard/components-next/ScheduleSend/ScheduleSendPopover.vue` - Componente del popover
- `app/javascript/dashboard/components-next/ScheduleSend/ScheduledChip.vue` - Componente del chip de estado
- `app/javascript/dashboard/api/telegramScheduleSend.js` - Servicio para programar mensajes de Telegram

### Archivos modificados:
- `app/javascript/dashboard/components/widgets/WootWriter/ReplyBottomPanel.vue` - Agregado botón y lógica
- `app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue` - Agregada prop conversation y método showAlert
- `app/javascript/dashboard/i18n/locale/en/scheduleSend.json` - Nuevas claves de traducción
- `app/javascript/dashboard/i18n/locale/es/scheduleSend.json` - Nuevas claves de traducción

## Funcionalidad

### Detección de canal
- Se detecta automáticamente si la conversación es de Telegram usando `conversation.inbox.channel_type === 'Channel::Telegram'`
- El botón solo aparece en conversaciones de Telegram (no en notas privadas)

### Flujo de uso
1. Usuario escribe mensaje en el composer
2. Hace clic en "Schedule Send"
3. Se abre popover para seleccionar fecha/hora
4. Confirma la fecha/hora
5. Aparece chip amarillo con la fecha programada
6. Al hacer clic en "Schedule Send" (botón principal), se envía al webhook

### Validaciones
- Fecha/hora debe ser futura
- Mensaje no puede estar vacío
- Todos los IDs requeridos deben estar presentes

### Payload del webhook
```json
{
  "source": "chatwoot",
  "channel": "telegram",
  "account_id": 123,
  "inbox_id": 456,
  "conversation_id": 789,
  "contact_id": 101,
  "to": [],
  "cc": [],
  "bcc": [],
  "subject": "",
  "message": "Texto del mensaje",
  "message_html": "Texto del mensaje",
  "message_text": "Texto del mensaje",
  "scheduled_at": "2025-01-21T18:00:00.000Z",
  "scheduled_at_local": "21/01/2025 18:00",
  "timezone_offset_minutes": -180
}
```

## Traducciones

### Inglés (en-US)
- `SCHEDULE_SEND.SCHEDULED_CHIP`: "Scheduled: {date}"
- `SCHEDULE_SEND.MESSAGE_REQUIRED`: "Message is required"

### Español (es-AR)
- `SCHEDULE_SEND.SCHEDULED_CHIP`: "Programado: {date}"
- `SCHEDULE_SEND.MESSAGE_REQUIRED`: "El mensaje es requerido"

## Uso

### Para usuarios:
1. Abrir conversación de Telegram
2. Escribir mensaje
3. Hacer clic en "Schedule Send"
4. Seleccionar fecha/hora futura
5. Confirmar
6. Hacer clic en "Schedule Send" para enviar

### Para desarrolladores:
```javascript
// Detectar si es conversación de Telegram
import { isTelegramConversation } from 'dashboard/helper/conversation';

const isTelegram = isTelegramConversation(conversation);

// Programar mensaje
import { scheduleTelegramMessage } from 'dashboard/api/telegramScheduleSend';

await scheduleTelegramMessage({
  accountId: 123,
  inboxId: 456,
  conversationId: 789,
  contactId: 101,
  message: "Hola mundo",
  scheduledAt: new Date('2025-01-21T18:00:00Z'),
  // ... otros parámetros
});
```

## Notas técnicas

- **Formato de fecha**: 24h en formato dd/MM/yyyy HH:mm
- **Timezone**: Se envía el offset del navegador del usuario
- **Validaciones**: Se realizan tanto en frontend como en el servicio
- **Manejo de errores**: Toast de éxito/error con mensajes descriptivos
- **Estado local**: Se mantiene en el componente ReplyBottomPanel

## Pruebas

### Casos de prueba:
1. **Conversación de Telegram**: Botón debe aparecer
2. **Conversación de Email**: Botón no debe aparecer
3. **Nota privada**: Botón no debe aparecer
4. **Fecha pasada**: Debe mostrar error
5. **Mensaje vacío**: Debe mostrar error
6. **Programación exitosa**: Debe mostrar toast de éxito
7. **Edición de fecha**: Debe permitir cambiar fecha programada
8. **Limpieza**: Debe permitir cancelar programación

### Verificación en n8n:
- Revisar que llegue el payload correcto
- Verificar que los IDs sean correctos
- Confirmar formato de fecha UTC y local
- Verificar timezone offset
