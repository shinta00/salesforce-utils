import { LightningElement, api } from "lwc";

export default class Group extends LightningElement {
  @api groupObject;
  @api registerComponent;
  @api caseData;
  @api fieldChangedHandler;
  @api fieldClickedHandler;
  @api fieldBluredHandler;
  @api getWorkObject;
  @api url;
  @api size = 12;

  @api
  reportError(reference, msg) {
    const field = this.template.querySelector("c-field");
    if (field) {
      field.reportError(reference, msg);
    } else {
      const layout = this.template.querySelector("c-layout");
      if (layout) {
        layout.reportError(reference, msg);
      } else {
        const view = this.template.querySelector("c-view");
        if (view) {
          view.reportError(reference, msg);
        }
      }
    }
  }
}
