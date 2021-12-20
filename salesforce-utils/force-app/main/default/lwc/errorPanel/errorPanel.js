import { LightningElement, api } from "lwc";

export default class ErrorPanel extends LightningElement {
  @api hasErrors;
  @api hideErrors;
  @api errors;
  @api titleMsg;
  @api message;
}
