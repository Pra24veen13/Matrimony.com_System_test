import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-audio-recorder',
  templateUrl: './audio-recorder.component.html',
  styleUrls: ['./audio-recorder.component.css'],
  standalone: true,
  imports: [CommonModule],
})
export class AudioRecorderComponent implements AfterViewInit {
  mode: 'recording' | 'playback' = 'recording';
  isRecording = false;
  isPlaying = false;
  showNextButton = true;
  nextEnabled = false;
  audioUrl: string | null = null;
  recordingTimeDisplay = '0:00 / 0:30';
  playbackTimeDisplay = '0:00 / 0:30';

  private mediaRecorder!: MediaRecorder;
  private chunks: Blob[] = [];
  private stream!: MediaStream;
  private audioContext: AudioContext | null = null;
  private analyser!: AnalyserNode;
  private dataArray!: Uint8Array;
  private animationId!: number;
  private timeoutId: ReturnType<typeof setInterval> | null = null;
  private recordingStartTime = 0;
  private audioPlayer: HTMLAudioElement | null = null;

  @ViewChild('waveformCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = canvas.offsetWidth;
    canvas.height = 80;
  }

  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  async startRecording() {
    if (this.isRecording) return;

    this.resetAudio();
    this.nextEnabled = false;
    this.isRecording = true;
    this.recordingTimeDisplay = '0:00 / 0:30';
    this.recordingStartTime = Date.now();

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = this.audioContext.createMediaStreamSource(this.stream);

    this.analyser = this.audioContext.createAnalyser();
    source.connect(this.analyser);
    this.analyser.fftSize = 256;
    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);

    this.drawWaveform();

    this.mediaRecorder = new MediaRecorder(this.stream);
    this.chunks = [];

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      cancelAnimationFrame(this.animationId);
      const blob = new Blob(this.chunks, { type: 'audio/webm' });
      this.audioUrl = URL.createObjectURL(blob);
      this.audioPlayer = new Audio(this.audioUrl);
      this.audioPlayer.preload = 'auto';

      this.audioPlayer.onended = () => {
        this.isPlaying = false;
        this.playbackTimeDisplay = '0:30 / 0:30';
      };

      this.cleanupStream();
    };

    this.mediaRecorder.start();

    this.timeoutId = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - this.recordingStartTime) / 1000);
      const minutes = Math.floor(elapsedSec / 60);
      const seconds = (elapsedSec % 60).toString().padStart(2, '0');
      this.recordingTimeDisplay = `${minutes}:${seconds} / 0:30`;

      if (elapsedSec >= 30) {
        this.stopRecording();
        this.nextEnabled = true;
      }
    }, 200);
  }

  stopRecording() {
    if (!this.isRecording) return;

    this.mediaRecorder.stop();
    this.isRecording = false;

    if (this.timeoutId) {
      clearInterval(this.timeoutId);
      this.timeoutId = null;
    }

    this.recordingTimeDisplay = '0:00 / 0:30';
  }

  goToPlayback() {
    if (!this.audioUrl) return;

    this.mode = 'playback';
    this.isPlaying = false;

    // Resume audio context if it's suspended (required on iOS)
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }

    if (this.audioContext) {
      const source = this.audioContext.createMediaElementSource(this.audioPlayer!);
      this.analyser = this.audioContext.createAnalyser();
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      this.analyser.fftSize = 256;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.drawWaveform();
    }
  }

  togglePlayPause() {
    if (!this.audioPlayer) return;

    // Resume audio context before playing (important for iOS Safari)
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }

    if (this.isPlaying) {
      this.audioPlayer.pause();
      this.isPlaying = false;
      cancelAnimationFrame(this.animationId);
    } else {
      this.audioPlayer.play().then(() => {
        this.isPlaying = true;

        this.audioPlayer!.ontimeupdate = () => {
          const current = Math.floor(this.audioPlayer!.currentTime);
          const minutes = Math.floor(current / 60);
          const seconds = (current % 60).toString().padStart(2, '0');
          this.playbackTimeDisplay = `${minutes}:${seconds} / 0:30`;
        };

        this.audioPlayer!.onended = () => {
          this.isPlaying = false;
          this.playbackTimeDisplay = '0:30 / 0:30';
          cancelAnimationFrame(this.animationId);
        };

        this.drawWaveform();
      }).catch((error) => {
        console.warn('Playback failed on iOS:', error);
        alert('Playback failed. Tap again to retry.');
      });
    }
  }

  reset() {
    this.audioUrl = null;
    this.nextEnabled = false;
    this.showNextButton = true;
    this.isRecording = false;
    this.isPlaying = false;
    this.recordingTimeDisplay = '0:00 / 0:30';
    this.playbackTimeDisplay = '0:00 / 0:30';

    if (this.timeoutId) {
      clearInterval(this.timeoutId);
      this.timeoutId = null;
    }

    this.resetAudio();

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.mode = 'recording';
  }

  submitRecording() {
    if (!this.audioUrl) {
      alert('No recording found!');
      return;
    }

    fetch(this.audioUrl)
      .then(response => response.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64Audio = reader.result as string;
          localStorage.setItem('recordedAudio', base64Audio);
          alert('Recording saved!');
        };
        reader.readAsDataURL(blob);

        this.reset();
      })
      .catch(() => alert('Failed to save the recording.'));
  }

  private drawWaveform() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx || !this.analyser) return;

    const draw = () => {
      this.animationId = requestAnimationFrame(draw);
      this.analyser.getByteTimeDomainData(this.dataArray);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#f26b8c';
      ctx.beginPath();

      const sliceWidth = canvas.width / this.dataArray.length;
      let x = 0;

      for (let i = 0; i < this.dataArray.length; i++) {
        const v = this.dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };
    draw();
  }

  private resetAudio() {
    if (this.audioPlayer) {
      try {
        this.audioPlayer.pause();
        this.audioPlayer.currentTime = 0;
      } catch (e) {
        console.warn('Error resetting audio player:', e);
      }
      this.audioPlayer = null;
    }
    this.isPlaying = false;
  }

  private cleanupStream() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.audioContext?.close();
    this.audioContext = null;
  }
}
