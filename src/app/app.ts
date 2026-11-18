import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Theme } from './core/theme';
import { AppStatus } from './shared/app-tools';
import { Scrollbars } from './core/scrollbars';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppStatus],
  template: '<router-outlet /><app-status />',
})
export class App {
  private readonly theme = inject(Theme);
  private readonly scrollbars = inject(Scrollbars);
}
