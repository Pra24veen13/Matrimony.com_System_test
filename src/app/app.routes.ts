import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ImageCarouselComponent } from './pages/image-carousel/image-carousel.component';
import { AudioRecorderComponent } from './pages/audio-recorder/audio-recorder.component';

export const routes: Routes = [
    {path:'',component:HomeComponent},
    {path:'images',component:ImageCarouselComponent},
    {path:'audio-recorder',component:AudioRecorderComponent}
];
