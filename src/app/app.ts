import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Theme } from './core/theme';
import { AppStatus } from './shared/app-tools';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppStatus],
  template: '<router-outlet /><app-status />',
})
export class App {
  private readonly theme = inject(Theme);
}
