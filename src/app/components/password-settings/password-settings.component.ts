import { Component } from '@angular/core';
import {FormsModule} from "@angular/forms";
import {NgForOf, NgIf} from "@angular/common";

@Component({
  selector: 'app-password-settings',
  templateUrl: './password-settings.component.html',
  styleUrls: ['./password-settings.component.scss'],
  standalone: true,
  imports: [
    FormsModule,
    NgForOf,
    NgIf
  ],
})
export class PasswordSettingsComponent {
  password: any;
  isEditing: true;

  editPassword() {

  }

  deletePassword() {

  }

  updatePassword() {

  }

  cancelEdit() {

  }
}
