const { Command } = require('discord.js-commando');
const { MessageEmbed } = require('discord.js');
const Youtube = require('simple-youtube-api');
const ffmpeg = require('fluent-ffmpeg');
const puppeteer = require('puppeteer');
const youtube = new Youtube(process.env.YOUTUBE_API_KEY);
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
            name: 'play',
            memberName: 'play',
            group: 'music',
            description: 'plays audio from youtube or facebook',
            guildOnly: true,
            userPermissions: ['ADMINISTRATOR'],
            clientPermissions: ['SPEAK', 'CONNECT'],
            args: [
                {
                    key: 'query',
                    prompt: 'what do you want to listen to?',
                    type: 'string',
                    validate: query => query.length > 0
                }
            ],
            throttling: {
                usages: 1,
                duration: 3
            }
        });
    }

    run = async(message, { query }) => {
        try {
            const voiceChannel = message.member.voice.channel;

            if (!voiceChannel) {
                const embed = new MessageEmbed().setColor('#ff0000').setTitle(':x: You need to join a voice channel first');
                return await message.say({ embed });
            }

            const embed = new MessageEmbed().setColor('#000099').setTitle(':arrows_counterclockwise: Loading');
            await message.say({ embed });

            if (query.match(/^(?!.*\?.*\bv=)https:\/\/www\.youtube\.com\/.*\?.*\blist=.*$/)) {
                const link = query.match(/^(?!.*\?.*\bv=)https:\/\/www\.youtube\.com\/.*\?.*\blist=.*$/)[0];
                const playlist = await youtube.getPlaylist(link);
                const playlistVideos = await playlist.getVideos();

                playlistVideos.forEach(async playlistVideo => {
                    const video = await youtube.getVideoByID(playlistVideo.id);
                    const durationString = message.guild.formatDurationString(video.duration.hours, video.duration.minutes, video.duration.seconds);
                    const data = {
                        type: 'youtube',
                        link: `https://www.youtube.com/watch?v=${video.id}`,
                        title: video.title,
                        by: video.channel.title,
                        duration: durationString !== '00:00:00' ? durationString : 'Live Stream',
                        thumbnail: video.thumbnails.high.url,
                        voiceChannel
                    };

                    message.guild.music.queue.push(data);

                    if (!message.guild.music.isPlaying) {
                        message.guild.music.isPlaying = true;
                        return message.guild.play(message.guild.music.queue, message);
                    }
                });
                if (message.guild.music.isPlaying) {
                    const embed = new MessageEmbed().setColor('#000099').setTitle(`:arrow_forward: Added "${playlist.title}" to queue (${playlistVideos.length} tracks)`);
                    return await message.say({ embed });
                }
            } else if (query.match(/^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/\S+/)) {
                const link = query.match(/^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/\S+/)[0];
                const id = link.replace(/(>|<)/gi, '').split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/)[2].split(/[^0-9a-z_\-]/i)[0];
                const video = await youtube.getVideoByID(id);
                const durationString = message.guild.formatDurationString(video.duration.hours, video.duration.minutes, video.duration.seconds);
                const data = {
                    type: 'youtube',
                    link,
                    title: video.title,
                    by: video.channel.title,
                    duration: durationString !== '00:00:00' ? durationString : 'Live Stream',
                    thumbnail: video.thumbnails.high.url,
                    voiceChannel
                };

                message.guild.music.queue.push(data);

                if (!message.guild.music.isPlaying) {
                    message.guild.music.isPlaying = true;
                    return message.guild.play(message.guild.music.queue, message);
                } else {
                    const embed = new MessageEmbed().setColor('#000099').setTitle(`:arrow_forward: Added "${data.title}" to queue`);
                    return await message.say({ embed });
                }
            } else if (query.match(/^(http(s)?:\/\/)?((w){3}.)?facebook?(\.com)?\/\S+\/videos\/\S+/)) {
                const link = query.match(/^(http(s)?:\/\/)?((w){3}.)?facebook?(\.com)?\/\S+\/videos\/\S+/)[0];
                const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
                const page = await browser.newPage();

                await page.goto(link, { waitUntil: 'networkidle2' });

                const titleHandle = await page.$('title');
                const metaHandle = await page.$('meta[property="og:video:url"]');
                
                let durationCode = (await page.content()).match(/mediaPresentationDuration=\\"\S+\\"/) || (await page.content()).match(/"duration":"\S+"/) || false;
                let durationArr = [0, 0, 0];

                if (durationCode && durationCode.toString().match(/mediaPresentationDuration=\\"\S+\\"/)) {
                    durationArr = durationCode.toString().replace(/mediaPresentationDuration=\\"/, '').replace(/\\"/, '').trim().split(/\D/).slice(2, 5).map(time => parseInt(time));
                } else if (durationCode && durationCode.toString().match(/"duration":"\S+"/)) {
                    durationCode.toString().match(/"duration":"T(\d+H)?(\d+M)?(\d+S")?/)[0].replace(/"duration":"/, '').replace(/"/, '').trim().match(/(\d+H)|(\d+M)|(\d+S)/g).forEach(time => {
                        if (time.toString().match(/\d+H/)) durationArr[0] = parseInt(time.match(/\d+/));
                        if (time.toString().match(/\d+M/)) durationArr[1] = parseInt(time.match(/\d+/));
                        if (time.toString().match(/\d+S/)) durationArr[2] = parseInt(time.match(/\d+/));
                    });
                }
                
                const durationString = durationArr ? message.guild.formatDurationString(durationArr[0], durationArr[1], durationArr[2] + 1) : 'Live Stream';
                const title = await page.evaluate(title => title.innerText.replace(/\s\|\sfacebook/i, ''), titleHandle);
                const videoLink = await page.evaluate(meta => meta.getAttribute('content'), metaHandle);
                const data = {
                    type: 'facebook',
                    link: videoLink,
                    title: title.split(' - ')[1],
                    by: title.split(' - ')[0],
                    duration: durationString,
                    voiceChannel
                };

                message.guild.music.queue.push(data);

                if (!message.guild.music.isPlaying) {
                    message.guild.music.isPlaying = true;
                    return message.guild.play(message.guild.music.queue, message);
                } else {
                    const embed = new MessageEmbed().setColor('#000099').setTitle(`:arrow_forward: Added "${data.title}" to queue`);
                    return await message.say({ embed });
                }
            } else if (query.match(/^(http(s)?:\/\/)?((w){3}\S)?\S+(\.)\S+\/\S+\.(\S){3}/)) {
                const link = query.match(/^(http(s)?:\/\/)?((w){3}\S)?\S+(\.)\S+\/\S+\.(\S){3}/)[0];
                const title = link.split('/')[link.split('/').length - 1].split('.')[0];

                ffmpeg.ffprobe(link, async(err, metaData) => {
                    if (err) throw err;
                    const duration = message.guild.formatDurationString(
                        new Date(Math.ceil(metaData.format.duration) * 1000).getUTCHours(),
                        new Date(Math.ceil(metaData.format.duration) * 1000).getUTCMinutes(),
                        new Date(Math.ceil(metaData.format.duration) * 1000).getSeconds()
                    );

                    const data = {
                        type: 'other',
                        link,
                        title,
                        duration,
                        voiceChannel
                    };

                    if (data) {
                        message.guild.music.queue.push(data);

                        if (!message.guild.music.isPlaying) {
                            message.guild.music.isPlaying = true;
                            return message.guild.play(message.guild.music.queue, message);
                        } else {
                            const embed = new MessageEmbed().setColor('#000099').setTitle(`:arrow_forward: Added "${data.title}" to queue`);
                            return await message.say({ embed });
                        }
                    }
                });
            } else {
                const videos = await youtube.searchVideos(query, 1);
                
                if (videos.length !== 1) {
                    const embed = new MessageEmbed().setColor('#ff0000').setTitle(':x: Nothing found');
                    return await message.say({ embed });
                }

                const video = await youtube.getVideoByID(videos[0].raw.id.videoId);
                const durationString = message.guild.formatDurationString(video.duration.hours, video.duration.minutes, video.duration.seconds);
                const data = {
                    type: 'youtube',
                    link: `https://www.youtube.com/watch?v=${video.id}`,
                    title: video.title,
                    by: video.channel.title,
                    duration: durationString !== '00:00:00' ? durationString : 'Live Stream',
                    thumbnail: video.thumbnails.high.url,
                    voiceChannel
                };

                message.guild.music.queue.push(data);

                if (!message.guild.music.isPlaying) {
                    message.guild.music.isPlaying = true;
                    return message.guild.play(message.guild.music.queue, message);
                } else {
                    const embed = new MessageEmbed().setColor('#000099').setTitle(`:arrow_forward: Added "${data.title}" to queue`);
                    return await message.say({ embed });
                }
            }
        } catch(err) {
            logger.log('error', err);
            const embed = new MessageEmbed().setColor('#ff0000').setTitle(':x: Cannot play this track');
            return message.say({ embed });
        }
    }
}
