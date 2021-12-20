import { LightningElement, api, track } from "lwc";

const CSS_CLASS = "modal-hidden";

export default class Modal extends LightningElement {
  @track showModal = false;

  @api
  set header(value) {
    this.hasHeaderString = value !== "";
    this._headerPrivate = value;
  }
  get header() {
    return this._headerPrivate;
  }

  hasHeaderString = false;
  _headerPrivate;

  @api show() {
    this.showModal = true;
  }

  @api hide() {
    this.showModal = false;
  }

  handleDialogClose() {
    const closedialog = new CustomEvent("closedialog");
    this.dispatchEvent(closedialog);
    this.hide();
  }

  handleSlotTaglineChange() {
    const taglineEl = this.template.querySelector("div");
    taglineEl.classList.remove(CSS_CLASS);
  }

  handleSlotFooterChange() {
    if (this.showModal) {
      const footerEl = this.template.querySelector("footer");
      footerEl.classList.remove(CSS_CLASS);
    }
  }
}
