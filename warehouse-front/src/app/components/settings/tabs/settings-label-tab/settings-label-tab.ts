import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LabelDesigner } from '../../../label-designer/label-designer';

@Component({
  selector: 'app-settings-label-tab',
  standalone: true,
  imports: [CommonModule, LabelDesigner],
  templateUrl: './settings-label-tab.html'
})
export class SettingsLabelTabComponent {}
