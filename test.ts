import { YankiConnect } from 'yanki-connect'

const client = new YankiConnect()

const info = await client.note.notesInfo({ notes: [1_717_045_501_049] })
