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
  private audioContext!: AudioContext;
  private analyser!: AnalyserNode;
  private dataArray!: Uint8Array;
  private animationId!: number;
  private timeoutId: ReturnType<typeof setInterval> | null = null;
  private recordingStartTime: number = 0;
  private audioPlayer?: HTMLAudioElement;

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

  startRecording() {
    if (this.isRecording) return;

    this.resetAudio();
    this.nextEnabled = false;
    this.isRecording = true;
    this.recordingTimeDisplay = '0:00 / 0:30';
    this.recordingStartTime = Date.now();

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      this.stream = stream;
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);

      this.analyser = this.audioContext.createAnalyser();
      source.connect(this.analyser);
      this.analyser.fftSize = 256;
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      this.drawWaveform();

      this.mediaRecorder = new MediaRecorder(stream);
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

        this.audioPlayer.addEventListener('ended', () => {
          this.isPlaying = false;
          this.playbackTimeDisplay = '0:30 / 0:30';
        });

        this.cleanupStream();
      };

      this.mediaRecorder.start();

      setTimeout(() => {
        this.recordingStartTime = Date.now();

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
      }, 0);
    });
  }

  stopRecording() {
    if (this.isRecording && this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.isRecording = false;

      if (this.timeoutId) {
        clearInterval(this.timeoutId);
        this.timeoutId = null;
      }

      this.recordingTimeDisplay = '0:00 / 0:30';
    }
  }

  goToPlayback() {
    if (!this.audioUrl) return;
    this.mode = 'playback';
    this.isPlaying = false;

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaElementSource(this.audioPlayer!);
    this.analyser = this.audioContext.createAnalyser();
    source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
    this.analyser.fftSize = 256;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.drawWaveform();
  }

  togglePlayPause() {
    if (!this.audioPlayer || isNaN(this.audioPlayer.duration)) return;

    if (this.isPlaying) {
      this.audioPlayer.pause();
      this.isPlaying = false;
      cancelAnimationFrame(this.animationId);
    } else {
      const playPromise = this.audioPlayer.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          this.isPlaying = true;
          this.audioPlayer!.addEventListener('timeupdate', this.updatePlaybackTime);
          this.audioPlayer!.addEventListener('ended', this.playbackEnded);
          this.drawWaveform();
        }).catch(error => {
          console.error("Playback failed:", error);
        });
      }
    }
  }

  private updatePlaybackTime = () => {
    if (!this.audioPlayer) return;
    const current = Math.floor(this.audioPlayer.currentTime);
    const minutes = Math.floor(current / 60);
    const seconds = (current % 60).toString().padStart(2, '0');
    this.playbackTimeDisplay = `${minutes}:${seconds} / 0:30`;
  };

  private playbackEnded = () => {
    this.isPlaying = false;
    this.playbackTimeDisplay = '0:30 / 0:30';
    cancelAnimationFrame(this.animationId);
    if(this.audioPlayer) {
      this.audioPlayer.removeEventListener('timeupdate', this.updatePlaybackTime);
      this.audioPlayer.removeEventListener('ended', this.playbackEnded);
    }
  };

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
        if (!isNaN(this.audioPlayer.currentTime)) {
          this.audioPlayer.pause();
          this.audioPlayer.currentTime = 0;
        }
      } catch (e) {
        console.warn('Audio player reset error:', e);
      }
      this.audioPlayer = undefined;
    }
    this.isPlaying = false;
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
          alert('Recording successfully stored!');
        };
        reader.readAsDataURL(blob);
        this.reset();
      })
      .catch(() => alert('Failed to save the recording.'));
  }

  private cleanupStream() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.audioContext?.close();
  }
}