import 'reflect-metadata'
import 'dotenv/config'

import { container } from 'tsyringe'
import discordLogs from 'discord-logs'
import { DIService, Client, tsyringeDependencyRegistryEngine } from 'discordx'
import { importx } from '@discordx/importer'

import { Database, ImagesUpload, ErrorHandler, Logger, WebSocket, PluginsManager } from '@services'
import { initDataTable, waitForDependency } from '@utils/functions'
import { Server } from '@api/server'

import { clientConfig } from './client'
import { apiConfig, generalConfig, websocketConfig } from '@config'
import { NoBotTokenError } from '@errors'

async function run() {
    // init logger, pluginsmanager and error handler
    const logger = await waitForDependency(Logger)
    await waitForDependency(ErrorHandler)
    const pluginManager = await waitForDependency(PluginsManager)

    // load plugins and import translations
    await pluginManager.loadPlugins()
    await pluginManager.syncTranslations()

    // strart spinner
    console.log('\n')
    logger.startSpinner('Starting...')

    // init the sqlite database
    const db = await waitForDependency(Database)
    await db.initialize()

    // init the client
    DIService.engine = tsyringeDependencyRegistryEngine.setInjector(container)
    const client = new Client(clientConfig)

    // Load all new events
    discordLogs(client, { debug: false })
    container.registerInstance(Client, client)

    // import all the commands and events
    await importx(__dirname + "/{events,commands}/**/*.{ts,js}")
    await pluginManager.importCommands()
    await pluginManager.importEvents()

        
    // init the data table if it doesn't exist
    await initDataTable()

    // init plugins services
    await pluginManager.initServices()

    // init the plugin main file
    await pluginManager.execMains()

    // log in with the bot token
    if (!process.env.BOT_TOKEN) throw new NoBotTokenError()
    client.login(process.env.BOT_TOKEN)
    .then(async () => {

        // start the api server
        if (apiConfig.enabled) {
            const server = await waitForDependency(Server)
            await server.start()
        }

        // connect to the dashboard websocket
        if (websocketConfig.enabled) {
            const webSocket = await waitForDependency(WebSocket)
            await webSocket.init(client.user?.id || null)
        }

        // upload images to imgur if configured
        if (process.env.IMGUR_CLIENT_ID && generalConfig.automaticUploadImagesToImgur) {
            const imagesUpload = await waitForDependency(ImagesUpload)
            await imagesUpload.syncWithDatabase()
        }
    })
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
}

run()