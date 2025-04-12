import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, HostListener } from '@angular/core';

@Component({
  selector: 'app-image-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-carousel.component.html',
  styleUrl: './image-carousel.component.css',
  schemas:[CUSTOM_ELEMENTS_SCHEMA]
})
export class ImageCarouselComponent {
 images = [
  'assets/Images/1.webp',
  'assets/Images/2.webp',
  'assets/Images/5.webp',
  'assets/Images/4.webp',
  'assets/Images/5.webp',
  ];
  currentIndex = 0;
  startX = 0;
  currentX = 0;
  isDragging = false;

  onTouchStart(event: TouchEvent | MouseEvent) {
    this.isDragging = true;
    this.startX = this.getX(event);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;
    this.currentX = this.getX(event);
  }

  @HostListener('document:mouseup', ['$event'])
  onMouseUp(event: MouseEvent) {
    if (!this.isDragging) return;
    this.onSwipeEnd(event);
  }

  onTouchMove(event: TouchEvent) {
    if (!this.isDragging) return;
    this.currentX = this.getX(event);
  }

  onTouchEnd(event: TouchEvent | MouseEvent) {
    if (!this.isDragging) return;
    this.onSwipeEnd(event);
  }

  private onSwipeEnd(event: TouchEvent | MouseEvent) {
    const deltaX = this.startX - this.getX(event);

    if (deltaX > 50 && this.currentIndex < this.images.length - 1) {
      this.currentIndex++;
    } else if (deltaX < -50 && this.currentIndex > 0) {
      this.currentIndex--;
    }

    this.isDragging = false;
  }

  private getX(event: TouchEvent | MouseEvent): number {
    if (event instanceof TouchEvent) {
      return event.touches[0]?.clientX || event.changedTouches[0]?.clientX || 0;
    } else {
      return event.clientX;
    }
  }

  goToSlide(index: number) {
    this.isDragging = false;
    this.currentIndex = index;
  }
}