/**
 * OOK Signal Generator
 * 2020 - https://github.com/rascafr/hackrf-tips-n-tricks
 *
 * Use it at your own risks.
 * Complete timings and frequency with your own readings obtained in the alarm tutorial.
 */

const fs = require('fs');

// Signal generator parameters
// -- Complete with your own values! --

const DATA_FREQUENCY = 30000; 	// for the data modulation frequency
const NB_DATA_WAVES = 4;		// number of sin waves used
const SAMPLE_RATE = 2500000;	// the hackrf transmit sample rate
const PAYLOAD_REPEAT = 2;		// how many sequences of bits should be sent after the header
const HACKRF_AMPLITUDE = 180; 	// generated sin wave amplitude: -90 ... +90
const BITS_TYPES = {
    'header': {
        high: 1 /* replace, in ms */,
        low: 1 /* replace, in ms */,
        highFirst: true
    },
    'logic_0': {
        high: 1 /* replace, in ms */,
        low: 1 /* replace, in ms */
    },
    'logic_1': {
        high: 1 /* replace, in ms */,
        low: 1 /* replace, in ms */
    },
    'gap': {
        high: 0, // leave to 0
        low: 1 /* replace, in ms */
    }
}
// -- end of customisation --

const DATA_STEP_PER_SAMPLE = 2 * Math.PI / (SAMPLE_RATE / DATA_FREQUENCY);
const BITS_SEQUENCE = process.argv[2];
const OUT_PATH = process.argv[3];
if (!BITS_SEQUENCE || !OUT_PATH) {
    console.error('Usage: node alarm-generator.js <BITS_SEQUENCE> <OUT_PATH>');
    return process.exit(-2);
}

console.log('Generating', BITS_SEQUENCE.length, 'bits sequence...');

const payloadBits = BITS_SEQUENCE.split('');
const payloadSymbols = generatePayloadArray(payloadBits);

const IQchannel = generatePayloadBits(payloadSymbols);
const IQdata = Buffer.from(IQchannel);

fs.writeFileSync(OUT_PATH, IQdata);
console.log('Saved I,Q data at', OUT_PATH, ', size is', IQdata.length, 'bytes');


function msToNbSamples(ms) {
    return Math.round(SAMPLE_RATE * (ms / 1000));
}

function generatePayloadArray(payloadBits) {
    let basePayload = [];
    basePayload.push('header');
    for (let r=0;r<PAYLOAD_REPEAT;r++) {
        basePayload.push(...payloadBits.map(bit => parseInt(bit, 10) ? 'logic_1' : 'logic_0'));
        basePayload.push('gap');
    }
    return basePayload;
}

function generateGap(buff, nbSamples) {
    buff.push(...new Array(nbSamples * 2 /* I and Q */).fill(0));
}

function generateSinusModulation(buff, nbSamples) {
    const tau = (2 * Math.PI / NB_DATA_WAVES);
    for (i=0;i<nbSamples;i++) {
        // generate n phases alternation signal
        let sin = Math.round(Math.sin(i*DATA_STEP_PER_SAMPLE + (i % NB_DATA_WAVES) * tau) * (HACKRF_AMPLITUDE / 2));
        if (sin > 255) sin = 255;
        buff.push(sin, sin); // I and Q are the same signals
    }
}

function generatePayloadBits(payloadSymbols) {
    const buff = [];
    generateGap(buff, msToNbSamples(0.5)); // add a leading gap
    payloadSymbols.forEach(symbol => {
        let { highFirst, high, low } = BITS_TYPES[symbol];
        if (highFirst) {
            generateSinusModulation(buff, msToNbSamples(high));
            generateGap(buff, msToNbSamples(low));
        } else {
            generateGap(buff, msToNbSamples(low));
            generateSinusModulation(buff, msToNbSamples(high));
        }
        
    });
    generateGap(buff, msToNbSamples(0.5)); // ... and a trailing gap
    return buff;
}