import { Component, inject, OnInit } from '@angular/core';
import { AppShellComponent } from './layout/app-shell/app-shell';
import { StorageService } from './core/services';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AppShellComponent],
  template: `<app-shell />`,
})
export class App implements OnInit {
  private storage = inject(StorageService);

  ngOnInit(): void {
    this.storage.init();
  }
}
