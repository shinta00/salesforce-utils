import { LightningElement, api } from "lwc";
import { apiService } from "c/service";
// import { url } from 'inspector';

export default class View extends LightningElement {
  @api viewObject = { visible: false };
  @api registerComponent;
  @api caseData;
  @api fieldChangedHandler;
  @api fieldClickedHandler;
  @api fieldBluredHandler;
  @api getWorkObject;
  @api size = 12;
  @api url;
  index;

  connectedCallback() {}

  get isVisible() {
    return this.viewObject && this.viewObject.visible;
  }

  @api
  setView(viewObject) {
    this.viewObject = viewObject;
  }

  get key() {
    return apiService.generateKey("v");
  }

  @api
  reportError(reference, msg) {
    const groups = this.template.querySelectorAll("c-group");
    if (groups) {
      groups.forEach(group => {
        group.reportError(reference, msg);
      });
    }
  }
}
