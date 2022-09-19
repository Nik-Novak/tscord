import { AnyEntity, EntityClass } from "@mikro-orm/core";
import { importx, resolve } from "@discordx/importer";
import { BaseTranslation } from "typesafe-i18n";
import dotenv from "dotenv";
import semver from "semver";
import fs from "fs"

import { generalConfig } from "@config";
import { BaseController } from "@utils/classes";

export class Plugin {
    // Common values
    private _path: string;
    private _name: string;
    private _version: string;
    private _valid: boolean = true;

    // Specific values
    private _entities: { [key: string]: EntityClass<AnyEntity> };
    private _controllers: { [key: string]: typeof BaseController };
    private _services: { [key: string]: any };
    private _translations: { [key: string]: BaseTranslation };

    constructor(path: string) {
        this._path = path;
    }

    public async load(): Promise<void> {
        // Check if the plugin.json is present
        if(!await fs.existsSync(this._path + "/plugin.json")) return this.stopLoad("plugin.json not found");

        // Read plugin.json
        const pluginConfig = await import(this._path + "/plugin.json");

        // Check if the plugin.json is valid
        if(!pluginConfig.name) return this.stopLoad("Missing name in plugin.json");
        if(!pluginConfig.version) return this.stopLoad("Missing version in plugin.json");
        if(!pluginConfig.tscordRequiredVersion) return this.stopLoad("Missing tscordRequiredVersion in plugin.json");

        // Check plugin.json values
        if(!pluginConfig.name.match(/^[a-zA-Z0-9-_]+$/)) return this.stopLoad("Invalid name in plugin.json");
        if(!semver.valid(pluginConfig.version)) return this.stopLoad("Invalid version in plugin.json");

        // Check if the plugin is compatible with the current version of Tscord
        if(!semver.satisfies(generalConfig.__templateVersion, pluginConfig.tscordRequiredVersion)) return this.stopLoad(`Incompatible with the current version of Tscord (v${generalConfig.__templateVersion})`);

        // Assign common values
        this._name = pluginConfig.name;
        this._version = pluginConfig.version;

        // Load specific values
        this._entities = await this.getEntities();
        this._controllers = await this.getControllers();
        this._services = await this.getServices();
        this._translations = await this.getTranslations();
    }

    private stopLoad(error: string): void {
        this._valid = false;
        console.error(`Plugin ${this._name ? this._name : this._path } ${this._version ? "v" + this._version : ""} is not valid: ${error}`);
    }

    private async getControllers(): Promise<{ [key: string]: typeof BaseController }> {
        if(!fs.existsSync(this._path + "/api/controllers")) return {}
        return import(this._path + "/api/controllers");
    }
    
    private async getEntities(): Promise<{ [key: string]: EntityClass<AnyEntity> }> { 
        if(!fs.existsSync(this._path + "/entities")) return {}
        return import(this._path + "/entities");
    }

    private async getServices(): Promise<{ [key: string]: any }> {
        if(!fs.existsSync(this._path + "/services")) return {}
        return import(this._path + "/services");
    }

    private async getTranslations(): Promise<{ [key: string]: BaseTranslation }> {
        const translations: { [key: string]: BaseTranslation } = {};

        const localesPath = resolve(this._path + "/i18n/*.{ts,js}");
        for(const localeFile of localesPath) {
            const locale = localeFile.split("/").at(-1)?.split(".")[0] || "unknow";
            translations[locale] = (await import(localeFile)).default;
        }

        return translations;
    }

    public loadEnv(): void {
        if(!fs.existsSync(this._path + "/services")) return
        dotenv.config({ path: this._path + "/.env" });
    }

    public execMain(): void {
        if(!fs.existsSync(this._path + "/main.ts")) return
        import(this._path + "/main.ts");
    }

    public async importCommands(): Promise<void> {
        await importx(this._path + "/commands/**/*.{ts,js}");
    }

    public async importEvents(): Promise<void> {
        await importx(this._path + "/events/**/*.{ts,js}");
    }

    public isValid(): boolean { return this._valid; }

    get path() { return this._path }
    get name() { return this._name }
    get version() { return this._version }

    get entities() { return this._entities }
    get controllers() { return this._controllers }
    get services() { return this._services }
    get translations() { return this._translations }
}