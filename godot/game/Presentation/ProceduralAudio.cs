using Godot;

namespace Zuendung.Game.Presentation;

public static class ProceduralAudio
{
    public static AudioStreamWav CreateCardPlay(bool opponent, int style)
    {
        const int mixRate = 44_100;
        const float duration = 0.42f;
        var sampleCount = (int)(mixRate * duration);
        var data = new byte[sampleCount * 2];
        uint noise = (uint)(0xA341316Cu + style * 977u + (opponent ? 8191u : 0u));
        var filteredNoise = 0f;
        for (var i = 0; i < sampleCount; i++)
        {
            var t = i / (float)mixRate;
            noise ^= noise << 13; noise ^= noise >> 17; noise ^= noise << 5;
            var rawNoise = (noise & 0xffff) / 32768f - 1f;
            filteredNoise = Mathf.Lerp(filteredNoise, rawNoise, opponent ? 0.055f : 0.085f);
            var slideEnvelope = Mathf.Sin(Mathf.Clamp(t / 0.31f, 0f, 1f) * Mathf.Pi) * Mathf.Exp(-1.8f * t);
            var landingTime = t - 0.31f;
            var landing = landingTime < 0f ? 0f : Mathf.Sin(Mathf.Tau * (78f + style * 7f) * landingTime) * Mathf.Exp(-32f * landingTime);
            var sample = filteredNoise * slideEnvelope * 0.11f + landing * 0.2f;
            var value = (short)Mathf.Clamp(sample * short.MaxValue, short.MinValue, short.MaxValue);
            data[i * 2] = (byte)(value & 0xff);
            data[i * 2 + 1] = (byte)((value >> 8) & 0xff);
        }
        return new AudioStreamWav
        {
            Format = AudioStreamWav.FormatEnum.Format16Bits,
            MixRate = mixRate,
            Stereo = false,
            Data = data
        };
    }

    public static AudioStreamWav CreateIgnition(int chainLength)
    {
        const int mixRate = 44_100;
        var duration = 0.16f + Mathf.Clamp(chainLength, 1, 8) * 0.025f;
        var sampleCount = (int)(mixRate * duration);
        var data = new byte[sampleCount * 2];
        var frequency = 125f + chainLength * 22f;
        uint noise = 0x9E3779B9u;
        for (var i = 0; i < sampleCount; i++)
        {
            var t = i / (float)mixRate;
            var envelope = Mathf.Exp(-10f * t) * Mathf.Clamp(t * 70f, 0, 1);
            noise ^= noise << 13; noise ^= noise >> 17; noise ^= noise << 5;
            var crackle = ((noise & 0xffff) / 32768f - 1f) * 0.23f;
            var tone = Mathf.Sin(Mathf.Tau * frequency * t) + 0.42f * Mathf.Sin(Mathf.Tau * frequency * 2.01f * t);
            var sample = (short)Mathf.Clamp((tone * 0.32f + crackle) * envelope * short.MaxValue, short.MinValue, short.MaxValue);
            data[i * 2] = (byte)(sample & 0xff);
            data[i * 2 + 1] = (byte)((sample >> 8) & 0xff);
        }
        return new AudioStreamWav
        {
            Format = AudioStreamWav.FormatEnum.Format16Bits,
            MixRate = mixRate,
            Stereo = false,
            Data = data
        };
    }
}
