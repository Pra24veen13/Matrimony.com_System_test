import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  menuOpen = false;
constructor(private _eref: ElementRef){

}
  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const clickedInside = this._eref.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.closeMenu();
    }
  }
  
  closeMenu() {
    this.menuOpen = false;
  }
}
