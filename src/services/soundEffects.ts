// Synthesized Web Audio API sound effects engine (Zero external audio file dependencies)

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volume: number = 0.25;

  private introMasterGain: GainNode | null = null;
  private activeIntroSources: Array<{ stop: () => void }> = [];
  private introStopTimer: any = null;
  private isIntroPlaying: boolean = false;
  private introStartTime: number = 0;

  private stateListeners: Array<(isRunning: boolean) => void> = [];

  private notifyState() {
    const running = this.isAudioRunning();
    for (const listener of this.stateListeners) {
      try {
        listener(running);
      } catch {}
    }
  }

  public subscribeState(listener: (isRunning: boolean) => void): () => void {
    this.stateListeners.push(listener);
    listener(this.isAudioRunning());
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== listener);
    };
  }

  private initCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.ctx.onstatechange = () => {
          this.notifyState();
          if (this.ctx && this.ctx.state === 'running' && !this.isIntroPlaying && this.introStartTime > 0) {
            const elapsed = Math.max(0, (performance.now() - this.introStartTime) / 1000);
            if (elapsed < 6.8) {
              this.executeIntroSound(elapsed);
            }
          }
        };
      }
    }
    if (this.ctx && (this.ctx.state as string) === 'suspended') {
      this.ctx.resume().then(() => {
        this.notifyState();
        if (this.ctx && this.ctx.state === 'running' && !this.isIntroPlaying && this.introStartTime > 0) {
          const elapsed = Math.max(0, (performance.now() - this.introStartTime) / 1000);
          if (elapsed < 6.8) {
            this.executeIntroSound(elapsed);
          }
        }
      }).catch(() => {});
    }
    return this.ctx;
  }

  public getAudioState(): AudioContextState | 'unavailable' {
    if (!this.ctx) return 'unavailable';
    return this.ctx.state;
  }

  public isAudioRunning(): boolean {
    return !!(this.ctx && this.ctx.state === 'running');
  }

  // Safely resume / unlock audio on user gesture
  public async resumeAudio(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    const ctx = this.initCtx();
    if (!ctx) return false;
    if ((ctx.state as string) === 'suspended') {
      try {
        await ctx.resume();
        this.notifyState();
      } catch {
        return false;
      }
    }
    this.notifyState();
    if (ctx.state === 'running' && !this.isIntroPlaying && this.introStartTime > 0) {
      const elapsed = Math.max(0, (performance.now() - this.introStartTime) / 1000);
      if (elapsed < 6.8) {
        this.executeIntroSound(elapsed);
      }
    }
    return ctx.state === 'running';
  }

  private stopSourcesOnly() {
    if (this.introStopTimer) {
      clearTimeout(this.introStopTimer);
      this.introStopTimer = null;
    }

    const previousGain = this.introMasterGain;
    this.introMasterGain = null;

    if (previousGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        previousGain.gain.setValueAtTime(previousGain.gain.value, now);
        previousGain.gain.linearRampToValueAtTime(0.0001, now + 0.05);
        setTimeout(() => {
          try {
            previousGain.disconnect();
          } catch {}
        }, 80);
      } catch {
        try {
          previousGain.disconnect();
        } catch {}
      }
    }

    const sources = this.activeIntroSources;
    this.activeIntroSources = [];
    for (const src of sources) {
      try {
        src.stop();
      } catch {}
    }
  }

  // Stop any ongoing cinematic intro audio immediately without racing new play calls
  public stopAniLoveCinematicIntro() {
    this.isIntroPlaying = false;
    this.introStartTime = 0;
    this.stopSourcesOnly();
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  // Generic play dispatcher
  public play(name: 'click' | 'cardFlip' | 'success' | 'quizCorrect' | 'quizWrong' | 'coin' | 'gachaPull' | 'legendaryUnlock' | 'rankUp' | string) {
    if (!this.isEnabled) return;
    switch (name) {
      case 'cardFlip':
        return this.playCardFlip();
      case 'success':
        return this.playSuccess();
      case 'quizCorrect':
        return this.playQuizCorrect();
      case 'quizWrong':
        return this.playQuizWrong();
      case 'coin':
        return this.playPurchase();
      case 'gachaPull':
        return this.playGachaRoll();
      case 'legendaryUnlock':
        return this.playLegendaryReveal();
      case 'rankUp':
        return this.playVictoryFanfare();
      case 'click':
      default:
        return this.playClick();
    }
  }

  // Soft subtle UI click
  public playClick() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(this.volume * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // ignore audio errors
    }
  }

  // Card / Tab Selection
  public playCardSelect() {
    this.playClick();
  }

  // 3D Card 360° Swoosh / Flip sound
  public playCardFlip() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.16);

      gain.gain.setValueAtTime(this.volume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // ignore audio errors
    }
  }

  // Success / Episode progress +1 / Bookmark added
  public playSuccess() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc1.frequency.setValueAtTime(783.99, now + 0.16); // G5
      osc1.frequency.setValueAtTime(1046.5, now + 0.24); // C6

      osc2.frequency.setValueAtTime(261.63, now);
      osc2.frequency.setValueAtTime(523.25, now + 0.24);

      gain.gain.setValueAtTime(this.volume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    } catch {
      // ignore audio errors
    }
  }

  // Correct answer in Anime Quiz
  public playQuizCorrect() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.07;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(this.volume * 0.4, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch {
      // ignore audio errors
    }
  }

  // Wrong answer buzzer
  public playQuizWrong() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.setValueAtTime(110, now + 0.12);

      gain.gain.setValueAtTime(this.volume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // ignore audio errors
    }
  }

  public playError() {
    this.playQuizWrong();
  }

  // Gacha Summon Roll Whirl
  public playGachaRoll() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.6);

      gain.gain.setValueAtTime(this.volume * 0.2, now);
      gain.gain.linearRampToValueAtTime(this.volume * 0.4, now + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.65);
    } catch {
      // ignore audio errors
    }
  }

  // Legendary UR / SSR Gacha Reveal
  public playLegendaryReveal() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const chords = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
      chords.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.05;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(this.volume * 0.4, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.8);
      });
    } catch {
      // ignore audio errors
    }
  }

  // Shop purchase sound effect
  public playPurchase() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.06;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(this.volume * 0.35, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.3);
      });
    } catch {
      // ignore audio errors
    }
  }

  // Theme switch / Modal swoop
  public playSwoosh() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.1);

      gain.gain.setValueAtTime(this.volume * 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // ignore audio errors
    }
  }

  // Voice line shout aura sound effect
  public playVoiceShout(pitchMultiplier: number = 1.0) {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const baseFreq = 340 * Math.max(0.7, Math.min(1.4, pitchMultiplier));
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.25);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(this.volume * 0.25, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // ignore audio errors
    }
  }
  // Victory Fanfare & Cheers sound effect
  public playVictoryFanfare() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Triumphant fanfare notes: C5, E5, G5, C6, G5, C6 (extended triumph)
      const notes = [
        { f: 523.25, d: 0.12, t: 0 },
        { f: 659.25, d: 0.12, t: 0.12 },
        { f: 783.99, d: 0.14, t: 0.24 },
        { f: 1046.5, d: 0.35, t: 0.38 },
        { f: 880.0, d: 0.15, t: 0.75 },
        { f: 1046.5, d: 0.15, t: 0.90 },
        { f: 1174.66, d: 0.15, t: 1.05 },
        { f: 1318.51, d: 0.6, t: 1.20 }
      ];

      notes.forEach(({ f, d, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + t;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(this.volume * 0.45, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + d);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + d);
      });
    } catch {
      // ignore audio errors
    }
  }

  // AniLove 6-7 Second Cinematic Anime Streaming Logo Intro Soundscape
  public async playAniLoveCinematicIntro(startOffset: number = 0) {
    if (!this.isEnabled) return;
    this.introStartTime = performance.now() - (startOffset * 1000);

    const ctx = this.initCtx();
    if (!ctx) return;

    if (ctx.state === 'running') {
      if (!this.isIntroPlaying) {
        this.executeIntroSound(startOffset);
      }
      return;
    }

    if ((ctx.state as string) === 'suspended') {
      try {
        await ctx.resume();
        this.notifyState();
        if ((ctx.state as string) === 'running' && !this.isIntroPlaying) {
          const elapsed = Math.max(0, (performance.now() - this.introStartTime) / 1000);
          if (elapsed < 6.8) {
            this.executeIntroSound(elapsed);
          }
        }
      } catch {}
    }
  }

  public executeIntroSound(startOffset: number = 0) {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx || ctx.state !== 'running') return;

    try {
      this.stopSourcesOnly();
      this.isIntroPlaying = true;
      if (this.introStartTime === 0) {
        this.introStartTime = performance.now() - (startOffset * 1000);
      }

      const now = ctx.currentTime;
      const masterVol = Math.max(0.75, (this.volume || 0.8) * 0.95);
      const totalIntroDuration = 7.0;
      const remainingDuration = Math.max(1.0, totalIntroDuration - startOffset);

      // Dedicated master gain node for clean mixing and instant stop/fade capability
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(masterVol, now);
      masterGain.connect(ctx.destination);
      this.introMasterGain = masterGain;

      // Helper to track sources for clean stopping
      const trackSource = (src: { stop: (when?: number) => void }) => {
        this.activeIntroSources.push({
          stop: () => {
            try {
              src.stop();
            } catch {}
          },
        });
      };

      // Helper function to synthesize a warm, resonant piano note with strictly monotonic timestamps
      const playPianoNote = (freq: number, targetSec: number, dur: number, vol = 0.5) => {
        if (targetSec < startOffset) return;
        const noteStart = now + (targetSec - startOffset);
        const noteAttack = noteStart + 0.02;
        const noteEnd = noteStart + dur;

        try {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'triangle';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(freq, noteStart);
          osc2.frequency.setValueAtTime(freq * 2.002, noteStart);

          gain.gain.setValueAtTime(0.0001, noteStart);
          gain.gain.linearRampToValueAtTime(masterVol * vol, noteAttack);
          gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(masterGain);

          osc1.start(noteStart);
          osc2.start(noteStart);
          osc1.stop(noteEnd + 0.05);
          osc2.stop(noteEnd + 0.05);

          trackSource(osc1);
          trackSource(osc2);
        } catch {}
      };

      // Helper function for crystalline magical bell / chime pings with strictly monotonic timestamps
      const playSparkleChime = (freq: number, targetSec: number, vol = 0.4, dur = 1.2) => {
        if (targetSec < startOffset) return;
        const chimeStart = now + (targetSec - startOffset);
        const chimeAttack = chimeStart + 0.015;
        const chimeEnd = chimeStart + dur;

        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, chimeStart);

          gain.gain.setValueAtTime(0.0001, chimeStart);
          gain.gain.linearRampToValueAtTime(masterVol * vol, chimeAttack);
          gain.gain.exponentialRampToValueAtTime(0.00005, chimeEnd);

          osc.connect(gain);
          gain.connect(masterGain);

          osc.start(chimeStart);
          osc.stop(chimeEnd + 0.05);
          trackSource(osc);
        } catch {}
      };

      // 1. Continuous Lush Atmospheric Anime Pad (Always audible across entire duration)
      // Chord: Fmaj7/9 (F3, C4, E4, A4, C5) - romantic, celestial anime ambiance
      const padFreqs = [174.61, 261.63, 329.63, 440.00, 523.25];
      const padAttack = now + Math.min(0.6, remainingDuration * 0.15);
      const padDecayStart = now + Math.max(padAttack + 0.1, remainingDuration - 0.7);
      const padEnd = now + remainingDuration;

      padFreqs.forEach((freq, idx) => {
        try {
          const padOsc = ctx.createOscillator();
          const padFilter = ctx.createBiquadFilter();
          const padGain = ctx.createGain();

          padOsc.type = idx % 2 === 0 ? 'sine' : 'triangle';
          padOsc.frequency.setValueAtTime(freq, now);

          padFilter.type = 'lowpass';
          padFilter.frequency.setValueAtTime(320, now);
          padFilter.frequency.linearRampToValueAtTime(800, padAttack);
          padFilter.frequency.exponentialRampToValueAtTime(280, padEnd);

          padGain.gain.setValueAtTime(0.0001, now);
          padGain.gain.linearRampToValueAtTime(masterVol * 0.35, padAttack);
          padGain.gain.setValueAtTime(masterVol * 0.35, padDecayStart);
          padGain.gain.exponentialRampToValueAtTime(0.0001, padEnd);

          padOsc.connect(padFilter);
          padFilter.connect(padGain);
          padGain.connect(masterGain);

          padOsc.start(now);
          padOsc.stop(padEnd + 0.1);
          trackSource(padOsc);
        } catch {}
      });

      // If user unmuted or started after 0s, play an immediate warm greeting chord so sound is instant!
      if (startOffset > 0.4) {
        playPianoNote(349.23, startOffset + 0.02, 1.8, 0.45); // F4
        playPianoNote(440.00, startOffset + 0.05, 1.8, 0.48); // A4
        playPianoNote(523.25, startOffset + 0.08, 1.8, 0.52); // C5
        playSparkleChime(1567.98, startOffset + 0.1, 0.38, 1.2); // G6
      }

      // Opening delicate sparkling bells (0.1s - 0.8s)
      playSparkleChime(2093.00, 0.15, 0.32, 0.9); // C7
      playSparkleChime(2637.02, 0.35, 0.30, 0.9); // E7
      playSparkleChime(3135.96, 0.55, 0.28, 1.0); // G7
      playSparkleChime(2349.32, 0.75, 0.32, 0.9); // D7

      // 2. Rising Energy Synth & Warm Piano Building Toward Heart Formation (0.8s - 1.7s)
      playPianoNote(349.23, 0.85, 1.3, 0.45); // F4
      playSparkleChime(1760.00, 0.95, 0.32, 0.8); // A6
      playPianoNote(440.00, 1.15, 1.2, 0.48); // A4
      playPianoNote(523.25, 1.40, 1.3, 0.52); // C5
      playPianoNote(659.25, 1.62, 1.1, 0.55); // E5

      // Smooth airy whoosh & particle shimmer at heart formation (1.3s - 2.0s)
      if (startOffset < 1.8) {
        const whooshStart = now + Math.max(0, 1.3 - startOffset);
        const whooshPeak = whooshStart + 0.4;
        const whooshEnd = whooshStart + 0.8;
        try {
          const whooshBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.9), ctx.sampleRate);
          const whooshData = whooshBuffer.getChannelData(0);
          for (let i = 0; i < whooshData.length; i++) {
            whooshData[i] = Math.random() * 2 - 1;
          }
          const whooshSource = ctx.createBufferSource();
          whooshSource.buffer = whooshBuffer;

          const whooshFilter = ctx.createBiquadFilter();
          whooshFilter.type = 'bandpass';
          whooshFilter.frequency.setValueAtTime(320, whooshStart);
          whooshFilter.frequency.exponentialRampToValueAtTime(2800, whooshPeak);
          whooshFilter.Q.setValueAtTime(2.5, whooshStart);

          const whooshGain = ctx.createGain();
          whooshGain.gain.setValueAtTime(0.0001, whooshStart);
          whooshGain.gain.linearRampToValueAtTime(masterVol * 0.4, whooshPeak);
          whooshGain.gain.exponentialRampToValueAtTime(0.0001, whooshEnd);

          whooshSource.connect(whooshFilter);
          whooshFilter.connect(whooshGain);
          whooshGain.connect(masterGain);
          whooshSource.start(whooshStart);
          whooshSource.stop(whooshEnd + 0.05);
          trackSource(whooshSource);
        } catch {}
      }

      // 3. Logo Lock-In & Burst Impact (1.8s - 2.5s)
      if (startOffset < 2.2) {
        const impactTime = now + Math.max(0, 1.85 - startOffset);

        // Gentle sub bass pulse
        try {
          const bassOsc = ctx.createOscillator();
          const bassGain = ctx.createGain();
          bassOsc.type = 'sine';
          bassOsc.frequency.setValueAtTime(85, impactTime);
          bassOsc.frequency.exponentialRampToValueAtTime(42, impactTime + 0.5);
          bassGain.gain.setValueAtTime(0.0001, impactTime);
          bassGain.gain.linearRampToValueAtTime(masterVol * 0.7, impactTime + 0.03);
          bassGain.gain.exponentialRampToValueAtTime(0.0001, impactTime + 0.65);
          bassOsc.connect(bassGain);
          bassGain.connect(masterGain);
          bassOsc.start(impactTime);
          bassOsc.stop(impactTime + 0.7);
          trackSource(bassOsc);
        } catch {}

        // Soft strings layer
        try {
          const stringOsc = ctx.createOscillator();
          const stringFilter = ctx.createBiquadFilter();
          const stringGain = ctx.createGain();
          stringOsc.type = 'sawtooth';
          stringOsc.frequency.setValueAtTime(261.63, impactTime);
          stringFilter.type = 'lowpass';
          stringFilter.frequency.setValueAtTime(650, impactTime);
          stringGain.gain.setValueAtTime(0.0001, impactTime);
          stringGain.gain.linearRampToValueAtTime(masterVol * 0.4, impactTime + 0.2);
          stringGain.gain.exponentialRampToValueAtTime(0.0001, impactTime + 1.8);
          stringOsc.connect(stringFilter);
          stringFilter.connect(stringGain);
          stringGain.connect(masterGain);
          stringOsc.start(impactTime);
          stringOsc.stop(impactTime + 1.9);
          trackSource(stringOsc);
        } catch {}
      }

      // Warm Piano Chord Layer
      playPianoNote(174.61, 1.85, 2.5, 0.55); // F3
      playPianoNote(261.63, 1.87, 2.4, 0.55); // C4
      playPianoNote(329.63, 1.89, 2.4, 0.58); // E4
      playPianoNote(440.00, 1.91, 2.3, 0.62); // A4
      playPianoNote(523.25, 1.93, 2.3, 0.65); // C5
      playPianoNote(659.25, 1.95, 2.2, 0.58); // E5

      // Bright crystalline chime flourish
      playSparkleChime(1046.50, 1.90, 0.45, 1.5); // C6
      playSparkleChime(1318.51, 1.97, 0.45, 1.5); // E6
      playSparkleChime(1567.98, 2.05, 0.42, 1.6); // G6
      playSparkleChime(2093.00, 2.13, 0.40, 1.7); // C7
      playSparkleChime(2637.02, 2.23, 0.36, 1.7); // E7

      // 4. Transition into Anime Scene & Energy Sweep (2.5s - 4.4s)
      playPianoNote(392.00, 2.7, 1.8, 0.45); // G4
      playPianoNote(493.88, 3.1, 1.7, 0.45); // B4
      playPianoNote(587.33, 3.5, 1.8, 0.48); // D5

      // Sweep whoosh across anime scene back to logo (3.7s - 4.4s)
      if (startOffset < 4.2) {
        const sweepStart = now + Math.max(0, 3.7 - startOffset);
        try {
          const sweepOsc = ctx.createOscillator();
          const sweepGain = ctx.createGain();
          sweepOsc.type = 'sine';
          sweepOsc.frequency.setValueAtTime(320, sweepStart);
          sweepOsc.frequency.exponentialRampToValueAtTime(1400, sweepStart + 0.5);
          sweepGain.gain.setValueAtTime(0.0001, sweepStart);
          sweepGain.gain.linearRampToValueAtTime(masterVol * 0.35, sweepStart + 0.3);
          sweepGain.gain.exponentialRampToValueAtTime(0.0001, sweepStart + 0.7);
          sweepOsc.connect(sweepGain);
          sweepGain.connect(masterGain);
          sweepOsc.start(sweepStart);
          sweepOsc.stop(sweepStart + 0.75);
          trackSource(sweepOsc);
        } catch {}
      }

      // 5. Emotional Logo Reveal ("AniLove" text appears at 4.5s - 5.4s)
      // Warm resolving anime cadence
      playPianoNote(261.63, 4.5, 2.3, 0.55); // C4
      playPianoNote(329.63, 4.6, 2.2, 0.55); // E4
      playPianoNote(392.00, 4.7, 2.1, 0.58); // G4
      playPianoNote(523.25, 4.8, 2.3, 0.65); // C5
      playSparkleChime(1567.98, 4.85, 0.38, 1.5); // G6
      playSparkleChime(2093.00, 4.95, 0.40, 1.7); // C7
      playSparkleChime(2637.02, 5.10, 0.35, 1.6); // E7

      // 6. Final Shimmering Tail & Soft Reverb Fading into Silence (5.5s - 6.8s)
      playSparkleChime(3135.96, 5.6, 0.28, 1.3); // G7
      playSparkleChime(2093.00, 6.0, 0.22, 0.9); // C7
    } catch {}
  }

  // Crunchyroll-style Anime Brand Intro Chime & Sonic Logo
  public playCrunchyrollIntro() {
    if (!this.isEnabled) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 1. Rising Energy Whoosh / Charge (0.0s to 0.7s)
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.7, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseBuffer.length; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(3200, now + 0.7);
      filter.Q.setValueAtTime(3.0, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.001, now);
      noiseGain.gain.linearRampToValueAtTime(this.volume * 0.2, now + 0.55);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.75);

      // 2. Cinematic Impact Chime Chord (At ~0.7s)
      const chimeTime = now + 0.65;
      const chimeChords = [
        { f: 587.33, d: 1.6, v: 0.35, t: 'sine' },      // D5
        { f: 739.99, d: 1.8, v: 0.35, t: 'triangle' },  // F#5
        { f: 880.00, d: 2.0, v: 0.40, t: 'sine' },      // A5
        { f: 1174.66, d: 2.2, v: 0.45, t: 'triangle' }, // D6
        { f: 1760.00, d: 1.5, v: 0.25, t: 'sine' },     // A6
        { f: 2349.32, d: 1.2, v: 0.15, t: 'sine' },     // D7 shimmer
      ];

      chimeChords.forEach(({ f, d, v, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = t as OscillatorType;
        osc.frequency.setValueAtTime(f, chimeTime);

        gain.gain.setValueAtTime(0, chimeTime);
        gain.gain.linearRampToValueAtTime(this.volume * v, chimeTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, chimeTime + d);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(chimeTime);
        osc.stop(chimeTime + d);
      });
    } catch {
      // Audio autoplay policy or device audio disabled - silently ignore
    }
  }
}

export const soundEffects = new SoundEngine();
