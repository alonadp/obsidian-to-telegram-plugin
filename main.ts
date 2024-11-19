import { App, Plugin, PluginSettingTab, Setting, Notice, MarkdownView, Modal, TFile, CachedMetadata, EmbedCache } from 'obsidian';

interface TelegramPluginSettings {
    botToken: string;
    channels: { [key: string]: string };
}

interface TelegramResponse {
    ok: boolean;
    result?: any;
    description?: string;
}

const DEFAULT_SETTINGS: TelegramPluginSettings = {
    botToken: '',
    channels: {}
};

export default class TelegramPlugin extends Plugin {
    settings: TelegramPluginSettings;

    async onload() {
        await this.loadSettings();

        this.addCommand({
            id: 'send-to-telegram',
            name: 'Отправить в Telegram',
            callback: () => this.showChannelSelectionModal()
        });

        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu) => {
                menu.addItem((item) => {
                    item
                        .setTitle('Отправить в Telegram')
                        .setIcon('paper-plane')
                        .onClick(() => this.showChannelSelectionModal());
                });
            })
        );

        this.addSettingTab(new TelegramSettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private async showChannelSelectionModal() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('Откройте заметку для отправки');
            return;
        }

        const content = activeView.getViewData();
        const channels = Object.keys(this.settings.channels);

        if (channels.length === 0) {
            new Notice('Добавьте каналы в настройках плагина');
            return;
        }

        const modal = new ChannelSelectionModal(
            this.app,
            channels,
            async (selectedChannel) => {
                await this.sendToTelegram(content, this.settings.channels[selectedChannel]);
            }
        );

        modal.open();
    }

    private async sendToTelegram(content: string, channelId: string) {
        try {
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                throw new Error('Не удалось получить активный файл');
            }

            const fileCache = this.app.metadataCache.getFileCache(activeFile);

            let imageFile: TFile | null = null;
            let textContent = content;

            // Проверяем наличие вложений
            const embeds = fileCache?.embeds;
            if (embeds && embeds.length > 0) {
                console.log('Найдены вложения:', embeds);

                // Ищем первое изображение среди вложений
                const imageEmbed = embeds.find(embed => 
                    embed.link.endsWith('.png') || 
                    embed.link.endsWith('.jpg') || 
                    embed.link.endsWith('.jpeg') ||
                    embed.link.endsWith('.gif')
                );

                if (imageEmbed) {
                    console.log('Найдено изображение:', imageEmbed);
                    
                    const abstractFile = this.app.vault.getAbstractFileByPath(imageEmbed.link);
                    if (abstractFile instanceof TFile) {
                        imageFile = abstractFile;
                        textContent = content.replace(imageEmbed.original, '').trim();
                    }
                }
            }

            if (imageFile) {
                console.log('Отправляем изображение с текстом');
                try {
                    const arrayBuffer = await this.app.vault.readBinary(imageFile);

                    const form = new FormData();
                    const blob = new Blob([arrayBuffer]);
                    form.append('photo', blob, imageFile.name);
                    form.append('chat_id', channelId);

                    if (textContent) {
                        form.append('caption', textContent);
                        form.append('parse_mode', 'Markdown');
                    }

                    const response = await fetch(
                        `https://api.telegram.org/bot${this.settings.botToken}/sendPhoto`,
                        {
                            method: 'POST',
                            body: form
                        }
                    );

                    const data = await response.json() as TelegramResponse;
                    console.log('Ответ от Telegram:', data);

                    if (!data.ok) {
                        throw new Error(data.description || 'Неизвестная ошибка');
                    }

                } catch (error) {
                    console.error('Ошибка при отправке изображения:', error);
                    await this.sendTextOnly(textContent, channelId);
                }
            } else {
                console.log('Изображений не найдено, отправляем только текст');
                await this.sendTextOnly(textContent, channelId);
            }

            new Notice('Успешно отправлено в Telegram');
        } catch (error) {
            console.error('Ошибка:', error);
            new Notice('Ошибка при отправке: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
        }
    }

    private async sendTextOnly(content: string, channelId: string) {
        const response = await fetch(
            `https://api.telegram.org/bot${this.settings.botToken}/sendMessage`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: channelId,
                    text: content,
                    parse_mode: 'Markdown'
                })
            }
        );

        const data = await response.json() as TelegramResponse;
        if (!data.ok) {
            throw new Error(data.description || 'Неизвестная ошибка');
        }
    }
}

class ChannelSelectionModal extends Modal {
    private channels: string[];
    private onSubmit: (channel: string) => void;

    constructor(app: App, channels: string[], onSubmit: (channel: string) => void) {
        super(app);
        this.channels = channels;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.createEl('h2', {text: 'Выберите канал'});

        this.channels.forEach(channel => {
            const btn = contentEl.createEl('button', {text: channel});
            btn.onclick = () => {
                this.onSubmit(channel);
                this.close();
            };
        });
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

class TelegramSettingTab extends PluginSettingTab {
    plugin: TelegramPlugin;

    constructor(app: App, plugin: TelegramPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Bot Token')
            .setDesc('Токен вашего Telegram бота')
            .addText(text => text
                .setValue(this.plugin.settings.botToken)
                .onChange(async (value) => {
                    this.plugin.settings.botToken = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h2', {text: 'Каналы'});

        Object.entries(this.plugin.settings.channels).forEach(([name, id]) => {
            new Setting(containerEl)
                .setName(name)
                .addText(text => text.setValue(id))
                .addButton(btn => btn
                    .setButtonText('Удалить')
                    .onClick(async () => {
                        delete this.plugin.settings.channels[name];
                        await this.plugin.saveSettings();
                        this.display();
                    }));
        });

        new Setting(containerEl)
            .setName('Добавить канал')
            .addText(text => text
                .setPlaceholder('Название канала'))
            .addText(text => text
                .setPlaceholder('ID канала'))
            .addButton(btn => btn
                .setButtonText('Добавить')
                .onClick(async () => {
                    const nameInput = containerEl.querySelector('input[placeholder="Название канала"]') as HTMLInputElement;
                    const idInput = containerEl.querySelector('input[placeholder="ID канала"]') as HTMLInputElement;
                    if (nameInput && idInput && nameInput.value && idInput.value) {
                        this.plugin.settings.channels[nameInput.value] = idInput.value;
                        await this.plugin.saveSettings();
                        this.display();
                    }
                }));
    }
}