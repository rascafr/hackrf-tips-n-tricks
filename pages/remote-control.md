# Remote control analysis

Let's try recording a Schneider Electric store & light remote control.

Sadly the Portapack record feature is limited to 500k samples per second, but we do not have this limitation when using the HackRF in USB mode (up to 20Ms/s).

## Settings

- **Center frequency:** 864MHz (Z-wave)
- **Bandwith:** 20MHz / 20Ms/s
- **Amplifier:** 14dB antenna amp enabled, LNA/IF gain set to 8 dB, baseband gain set to 20 dB

## Receive the data

`remote-extract.raw` file will contains both 8bit I and Q (complex quadrature) signal data in the following order: `IQIQIQIQ...`

**Source**:

https://github.com/mossmann/hackrf/blob/master/host/hackrf-tools/src/hackrf_transfer.c

```c
typedef struct 
{
    char        chunkID[4]; /* 'data' */
    uint32_t    chunkSize; /* Size of data in bytes */
    /* Samples I(8bits) then Q(8bits), I, Q ... */
} t_DataChunk;
```

So, if we record at 20Ms/s during 100ms, we'll have 2 million samples, with 2 bytes per sample (I and Q), so 4MB of data.

```bash
hackrf_transfer -r remote-extract.raw -f 864000000 -s 20000000 -a 1 -l 5 -g 20
```

## Observe the data

We can use Audacity, just set the following settings to analyse the waveforms: 8 bits, signed, 2 channels (I and Q, shifted apart about 90 degrees)

Here what the remote signal looks like in the time domain:

![alt text](../assets/images/remote-bpsk.png)

From now, we can assume that the signal has been modulated using:

- B**F**SK, or Binary **Frequency** Shift Keying, https://en.wikipedia.org/wiki/Frequency-shift_keying

- B**P**SK, or Binary **Phase** Shift Keying, https://en.wikipedia.org/wiki/Phase-shift_keying

## GNU Radio Companion

From the extracted raw 8bit file, we can perfom multiple operations in GNU Radio Companion.

First thing to do is to convert the IQ sequence bytes into a real complex value with the `IChar To Complex` bloc.

Next we'll remove the DC offset with the `DC Blocker bloc`, as there is one according to the official HackRF documentation.

> Samples produced by HackRF are measurements of radio waveforms, but the measurement method is prone to a DC bias introduced by HackRF. It's an artifact of the measurement system, not an indication of a received radio signal. DC offset is not unique to HackRF; it is common to all quadrature sampling systems.

![alt text](../assets/images/remote-grc.png)

This will produce the following FFT graph (centered at 864 MHz):

![alt text](../assets/images/remote-fft-grc-new.png)

## Decoding the signal

Let's assume the signal has been encoded using **BFSK**, we'll use the spectrogram (FFT) viewer mode of Audacity.

The settings are the following one (if translated to 44100 Hz sample rate in the software - because Audacity doesn't support 20 MHz)

- **Scale:** Linear
- **Min Frequency:** 300 Hz (translated low frequency is 136 kHz)
- **Max Frequency:** 800 Hz (translated high frequency is 360 kHz)
- **Window:** Hann, 256
- **Colors:** Gain 20 dB, Range 10 dB (Greyscale)

Let's import two recorded signals with this setup, for instance in our case, the light control order, ON and OFF.

![alt text](../assets/images/remote-signal-spectrogram.png)

With a bit of highlight, we can note:

- an identical leading bits, that can be identified as header / sync bits

- the difference in both what seems to be the command / address of the light to be controlled, and a pack of bits at the end that might be a checksum

- trailing bits (*"0"* symbols, low frequency) 

If we zoom into the difference between the "ON" and "OFF" commands, we spot the signal difference between both waveforms:

![alt text](../assets/images/remote-signal-spectrogram-zoom.png)

**Note:** Frequency is not really stable enought to assume that this is pure BFSK.

Instead, we might have a signal modulated using either BPSK (phase) or BFSK (frequency) with Manchester code (https://en.wikipedia.org/wiki/Manchester_code).

We'll dig into that later...

**To be seen and tested:**

- Manchester code
- Miller code
- PLL
- Costas loop

A very good research paper about BPSK demodulation: https://www2.eecs.berkeley.edu/Pubs/TechRpts/2017/EECS-2017-91.pdf