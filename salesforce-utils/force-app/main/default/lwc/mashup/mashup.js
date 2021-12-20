import { LightningElement, api, track } from "lwc";

export default class Mashup extends LightningElement {
  @api mashupUrl;
  @api mashupHeight;
  @api params;
  @api recordId;

  @track isInitialized = true;

  renderedCallback() {}

  reload() {
    window.location.reload();
  }

  get url() {
    return this.recordId
      ? this.mashupUrl + `&RecordId=${this.recordId}`
      : this.mashupUrl;
  }

  get mashupStyle() {
    if (!this.mashupHeight)
      return `height: ${this.mashupHeight}px; width: 100%;`;
    let mashupHeight = this.mashupHeight.endsWith("px")
      ? this.mashupHeight
      : (this.mashupHeight += "px");
    return `height: ${mashupHeight}; width: 100%;`;
  }
}
