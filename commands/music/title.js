const { Command } = require('discord.js-commando');
const { MessageEmbed } = require('discord.js');
const winston = require('winston');

const logger = winston.createLogger({
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs.log' }),
    ],
    format: winston.format.combine(
        winston.format.printf(log => `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} - [${log.level.toUpperCase()}] - ${log.message}`),
    )
});

module.exports = class Play extends Command {
    constructor(client) {
        super(client, {
            name: 'title',
            memberName: 'title',
            group: 'music',
            description: 'changes the title of the current played title (and loop if it\'s the same)',
            guildOnly: true,
            args: [
                {
                    key: 'title',
                    prompt: 'What should the new title be?',
                    type: 'string',
                    validate: query => query.length > 0
                }
            ],
            userPermissions: ['ADMINISTRATOR'],
            throttling: {
                usages: 1,
                duration: 3
            }
        });
    }

    run = async (message, { title }) => {
        try {
            if (!message.guild.music.nowPlaying) {
                const embed = new MessageEmbed()
                    .setColor('#000099')
                    .setTitle(':musical_note: Nothing is playing right now');
                return await message.say({ embed });
            }
            message.guild.music.nowPlaying.title = title;
            if (message.guild.music.loop === message.guild.music.nowPlaying) {
                message.guild.music.loop.title = title;
            }
            const embed = new MessageEmbed()
                .setColor('#000099')
                .setTitle(`:new: Title is now ${title}`);
            return await message.say({ embed });
        } catch(err) {
            logger.log('error', err);
            const embed = new MessageEmbed().setColor('#ff0000').setTitle(`:x: Error occured: ${err.message}`);
            return message.say({ embed });
        }
    }
}