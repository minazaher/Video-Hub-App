import {Component, Input, Output, EventEmitter} from '@angular/core';

import type {
  AllowedScreenshotHeight,
  AllowedScreenshotHeightString
} from '../../../../interfaces/final-object.interface';
import type {HistoryItem} from '../../../../interfaces/shared-interfaces';
import type {ImportStage} from '../../../../node/main-support';
import type {WizardOptions} from '../../../../interfaces/wizard-options.interface';

import {historyItemRemove, slowFadeIn} from '../../common/animations';
import {GLOBALS} from "../../../../node/main-globals";

@Component({
  selector: 'app-wizard',
  templateUrl: './wizard.component.html',
  styleUrls: [
    '../settings.scss',
    '../buttons.scss',
    '../search-input.scss',
    '../wizard-button.scss',
    './wizard.component.scss'
  ],
  animations: [historyItemRemove, slowFadeIn]
})
export class WizardComponent {
  private selectedIndex: number;
  isPasswordPromptVisible = false;

  @Output() clearRecentlyViewedHistory = new EventEmitter<any>();
  @Output() hideWizard = new EventEmitter<any>();
  @Output() importFresh = new EventEmitter<any>();
  @Output() loadFromFile = new EventEmitter<any>();
  @Output() openFromHistory = new EventEmitter<{ index: number, password: string }>();
  @Output() removeFromHistory = new EventEmitter<number>();
  @Output() selectOutputDirectory = new EventEmitter<any>();
  @Output() selectSourceDirectory = new EventEmitter<any>();

  @Input() canCloseWizard: boolean;
  @Input() importStage: ImportStage;
  @Input() vhaFileHistory: HistoryItem[];
  @Input() wizard: WizardOptions;
  visible: boolean = false;
  showPassword: boolean = false;


  /**
   * Opens the password prompt given the index of the recently viewed history item.
   *
   * @param {number} index - The index of the recently viewed history item.
   * @return {void} This function does not return a value.
   */

  openPasswordPrompt(index: number): void {
    this.selectedIndex = index;
    this.isPasswordPromptVisible = true;
  }

  /**
   * Handles the submission of a password, If its not given, set as NONE.
   *
   * @param {string} password - The password to be submitted.
   * @return {void} This function does not return a value.
   */

  handlePasswordSubmission(password: string): void {
    password = password.trimEnd() || 'NONE';
    this.openFromHistory.emit({index: this.selectedIndex, password});
    this.isPasswordPromptVisible = false;
  }

  viewPassword(){
    this.visible = !this.visible
    this.showPassword =!this.showPassword;
  }

  /**
   * Only allow characters and numbers for hub name
   * @param event key press event
   */
  public validateHubName(event: KeyboardEvent): boolean {
    const keyCode = event.charCode; // deprecated but it works
    if (keyCode === 32) {
      return true;
    } else if (48 <= keyCode && keyCode <= 57) {
      return true;
    } else if (65 <= keyCode && keyCode <= 90) {
      return true;
    } else if (97 <= keyCode && keyCode <= 122) {
      return true;
    }
    return false;
  }

  removeHistoryItem(event: Event, item: number) {
    event.stopPropagation();
    this.removeFromHistory.emit(item);
  }

  /**
   * Called on screenshot size dropdown select
   * @param pxHeightForImport - string of number of pixels for the height of each screenshot
   */
  selectScreenshotSize(pxHeightForImport: AllowedScreenshotHeightString | string): void {
    const height: AllowedScreenshotHeight = parseInt(pxHeightForImport, 10) as AllowedScreenshotHeight;
    this.wizard.screenshotSizeForImport = height;
  }

  /**
   * Called on screenshot size dropdown select
   * @param pxHeightForImport - string of number of pixels for the height of each screenshot
   */
  selectClipSize(pxHeightForImport: AllowedScreenshotHeightString | string): void {
    const height: AllowedScreenshotHeight = parseInt(pxHeightForImport, 10) as AllowedScreenshotHeight;
    this.wizard.clipHeight = height;
  }

  /**
   * Called on screenshot size dropdown select
   * @param screens - string of number of screenshots per video
   */
  selectNumOfScreens(screens: string): void {
    if (this.wizard.isFixedNumberOfScreenshots) {
      this.wizard.ssConstant = parseFloat(screens);
    } else {
      this.wizard.ssVariable = parseFloat(screens);
    }
  }

  /**
   * Called on screenshot options selection HTML
   * @param screens - string of number of snipppets per clip
   */
  selectNumOfClipSnippets(screens: string): void {
    this.wizard.clipSnippets = parseFloat(screens);
  }

  /**
   * Called on screenshot options selection HTML
   * @param length - string of number of seconds per snippet in each clip
   */
  selectLengthOfClipSnippets(length: string): void {
    this.wizard.clipSnippetLength = parseFloat(length);
  }

  /**
   * Sets the `isFixedNumberOfScreenshots` boolean
   * true = N screenshots per video
   * false = 1 screenshot per N minutes
   * @param bool boolean
   */
  setScreensPerVideo(bool: boolean): void {
    this.wizard.isFixedNumberOfScreenshots = bool;
  }

}
