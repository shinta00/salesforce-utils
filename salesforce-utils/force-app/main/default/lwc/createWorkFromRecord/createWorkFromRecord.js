import { LightningElement, track, api, wire } from "lwc";
import { apiService } from "c/service";
import {
  getRecord,
  generateRecordInputForUpdate,
  updateRecord,
  getFieldValue
} from "lightning/uiRecordApi";
import { CurrentPageReference } from "lightning/navigation";
import { fireEvent } from "c/pegapubsub";
import USER_ID from "@salesforce/user/Id";
import NAME_FIELD from "@salesforce/schema/User.Name";
import EMAIL_FIELD from "@salesforce/schema/User.Email";

export default class CreateWorkFromRecord extends LightningElement {
  cardIcon = "utility:record_create";
  defaultCardMode = "createWork";
  assignmentMode = "assignment";
  processAssignmentMode = "workobject";

  @track
  state = {
    mode: this.defaultCardMode,
    assignmentId: null,
    caseId: null,
    reviewCaseId: null,
    showAssignmentLink: false,
    title: this.title ? this.title : "Create Case From Record",
    icon: this.cardIcon,
    recordHasCase: false
  };

  @api url;
  @api flows;
  @api mode;
  @api processId;
  @api caseType;
  @api title;

  @track caseTypes = [];
  @track sfdcRecord;
  @track newHarnessView;
  @track view;
  @track showSpinner;

  subscription = {};
  @track msg;

  @wire(CurrentPageReference) pageRef;
  @wire(getRecord, {
    recordId: USER_ID,
    fields: [NAME_FIELD, EMAIL_FIELD]
  })
  async wireuser({ error, data }) {
    if (error) {
      apiService.showError(error, this);
    } else if (data) {
      this.email = getFieldValue(data, EMAIL_FIELD);
      this.name = getFieldValue(data, NAME_FIELD);
      await this.init();
    }
  }

  @api recordId;
  @wire(getRecord, {
    recordId: "$recordId",
    layoutTypes: ["Full"],
    modes: ["Edit"]
  })
  async wireSfdcRecord({ error, data }) {
    if (error) {
      apiService.showError(error, this);
    } else if (data) {
      this.sfdcRecord = { data };
      await this.getCase();
    }
  }

  async init() {
    if (this.url) {
      await apiService.initComponent(this);
      if (this.mode !== "Review") this.getCaseTypes();
    }
  }

  async connectedCallback() {
    this.state.title = this.title;
    this.init();
  }

  async getCaseTypes() {
    try {
      let types = [];
      let currentTypes = await apiService.getCaseTypes(this.url);
      if (currentTypes && currentTypes.caseTypes) {
        currentTypes.caseTypes.forEach(caseType => {
          if (caseType.CanCreate === true || caseType.CanCreate === "true") {
            caseType.caseUrl = this.url;
            if (caseType.startingProcesses[0].name) caseType.name = caseType.startingProcesses[0].name;
            types.push(caseType);
          }
        });
      }

      let flows = [];
      if (types && types && types.length > 0) {
        if (this.flows) {
          this.flows = this.flows.toUpperCase();
          flows = this.flows.split(/\s*,\s*/);
          types = types.filter(
            caseType =>
              (caseType.CanCreate === true || caseType.CanCreate === "true") &&
              (!this.flows || flows.includes(caseType.name.toUpperCase()))
          );
        }
      }
      this.caseTypes = types;
    } catch (err) {
      apiService.showError(err, this);
    }
  }

  async getCase() {
    if (!this.sfdcRecord) return;
    try {
      const caseId = sessionStorage.getItem(this.recordId);
      this.state.icon = "utility:case";
      let recordCaseId = getFieldValue(
        this.sfdcRecord.data,
        this.sfdcRecord.data.apiName + ".CaseId__c"
      );
      if (recordCaseId && recordCaseId !== caseId) {
        this.state.recordHasCase = true;
        this.state.reviewCaseId = recordCaseId;
        this.view = await apiService.getPage(
          this.url,
          this.state.reviewCaseId,
          "Review"
        );
        let workObject = await apiService.getCase(
          this.url,
          this.state.reviewCaseId
        );

        if (workObject.assignments && workObject.assignments.length > 0) {
          workObject.assignments.forEach(itm => {
            if (this.email.toUpperCase() === itm.routedTo.toUpperCase()) {
              this.state.assignmentId = workObject.assignments[0].ID;
              this.state.showAssignmentLink = true;
            }
          });
        } else {
          this.state.showAssignmentLink = false;
        }
        this.state.title = `${this.state.reviewCaseId.split(" ")[1]} - ${
          workObject.status
        }`;
        this.view.visible = true;
        this.template.querySelector("c-view").setView(this.view);
        this.showSpinner = false;
      } else {
        this.state.recordHasCase = false;
        this.showAssignmentLink = false;
        this.state.reviewCaseId = null;
      }
    } catch (error) {
      apiService.logError(error);
      this.state.title = this.title;
      this.template.querySelector("c-view").setView({});
      this.showSpinner = false;
      apiService.showError(error, this);
    }
  }

  handleClick(evt) {
    this.state.assignmentId = null;
    this.state.caseId = null;

    let idx = evt.target.dataset.index;
    let caseType = this.caseTypes[idx];
    if (caseType.startingProcesses && caseType.startingProcesses.length > 0 &&
      (caseType.startingProcesses[0].requiresFieldsToCreate === true ||
        caseType.startingProcesses[0].requiresFieldsToCreate === "true")
    ) {
      this.showNewHarness(caseType);
    } else {
      this.createCase(caseType);
    }
  }

  handleAssignmentClick() {
    this.state.mode = this.assignmentMode;
    this.state.caseId = this.state.reviewCaseId;
    if (this.recordId) sessionStorage.setItem(this.recordId, this.state.caseId);
  }

  async showNewHarness(caseType) {
    try {
      let newHarness = await apiService.getCaseTypeDetails(
        this.url,
        caseType.ID
      );
      newHarness.creation_page.visible = true;
      this.newHarnessView = newHarness.creation_page;
      this.state.mode = "newharness";
      this.caseType = caseType.ID;
      this.processId = caseType.startingProcesses[0].ID;
    } catch (err) {
      apiService.logError(err);
      if (
        err &&
        err.errors &&
        err.errors.length > 0 &&
        err.errors[0].ID === "Pega_API_023"
      ) {
        apiService.showMessage(
          "No Assignments",
          err.errors[0].message,
          this,
          "info"
        );
      } else {
        apiService.showError(err, this);
      }
    }
    this.showSpinner = false;
  }

  async createCase(caseType) {
    try {
      let content = {};
      if (this.recordId) {
        content = {
          RecordJsonData: JSON.stringify(this.sfdcRecord.data.fields),
          RecordId: this.recordId
        };
      }
      let body = {
        caseTypeID: caseType.ID,
        content
      };

      if (caseType.startingProcesses && 
        caseType.startingProcesses.length > 0 && caseType.startingProcesses[0].ID) {
        body.processID = caseType.startingProcesses[0].ID;
      } else {
        body.processID = "";
      }
      
      let newCase = await apiService.createCase(this.url, body);
      if (this.recordId) sessionStorage.setItem(this.recordId, newCase.ID);

      if (newCase.nextAssignmentID) {
        this.state.assignmentId = newCase.nextAssignmentID;
        this.state.caseId = newCase.ID;
        this.state.mode = this.processAssignmentMode;
        fireEvent(this.pageRef, "workObjectCreated", newCase.ID);
      } else {
        apiService.showMessage("Case created", `Case created`, this, "info");
      }

      await this.setRecordCaseId();
    } catch (err) {
      apiService.logError(err);
      apiService.showError(err, this);
    }
    this.showSpinner = false;
  }

  async setRecordCaseId() {
    if (this.sfdcRecord) {
      let recordInput = await generateRecordInputForUpdate({
        apiName: this.sfdcRecord.data.apiName,
        childRelationships: {},
        fields: {
          CaseId__c: {
            value: this.state.caseId
          }
        },
        id: this.recordId
      });
      updateRecord(recordInput);
    }
  }

  async handleWorkObjectClosed() {
    this.state.mode = this.defaultCardMode;
    this.state.title = this.title;
    this.state.icon = this.cardIcon;
    this.state.assignmentId = null;
    this.state.caseId = null;
    this.state.reviewCaseId = sessionStorage.getItem(this.recordId);
    sessionStorage.removeItem(this.recordId);
    await this.getCase();
  }

  async handleChangeTitle(event) {
    if (this.recordId && event.detail.caseKey && event.detail.assignmentId) {
      if (this.sfdcRecord) {
        let recordCaseId = getFieldValue(
          this.sfdcRecord.data,
          this.sfdcRecord.data.apiName + ".CaseId__c"
        );
        if (!recordCaseId) {
          await this.setRecordCaseId();
          this.state.assignmentId = event.detail.assignmentId;
          this.state.caseId = event.detail.caseKey;
          this.state.recordHasCase = true;
          this.state.mode = this.processAssignmentMode;
        }
      }
    }

    this.state.title = `${event.detail.caseName} - ${event.detail.caseId} - ${event.detail.action}`;
    this.state.icon = "utility:case";
  }

  get isCreateWork() {
    return this.state.mode === this.defaultCardMode;
  }

  get isAssignmentMode() {
    return this.state.mode === this.assignmentMode;
  }

  get viewOnlyMode() {
    return this.mode === "Review";
  }
}
