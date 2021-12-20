import { ShowToastEvent } from "lightning/platformShowToastEvent";
import generateJWT from "@salesforce/apex/PegaJwtUtil.generateJWT";

const systemsMap = {};

export const apiService = {
	createCase,
	getDataPage,
	getAssignment,
	getNextAssignment,
	getFieldsForAssignment,
	getCaseTypeDetails,
	getView,
	getPage,
	getCaseTypes,
	getOperator,
	getWorkBasket,
	getWorkList,
	getCase,
	performAction,
	performRefreshOnAssignment,
	showError,
	showErrorMessage,
	updateCase,
	showMessage,
	debounce,
	generateKey,
	decodeHTML,
	isInitialized,
	initComponent,
	attachFile,
	getAttachments,
	deleteAttachment,
	downloadAttachment,
	logError,
	prompt,
	confirm,
};

let endpoints = {
	BASEURL: "",
	AUTH: "authenticate",
	CASES: "cases",
	CASETYPES: "casetypes",
	VIEWS: "views",
	ASSIGNMENTS: "assignments",
	ACTIONS: "actions",
	PAGES: "pages",
	DATA: "data",
	REFRESH: "refresh"
};

let genericErrorMsg =
	"An error occured, please contact your system administrator";

function isInitialized(url) {
	return systemsMap[url] && systemsMap[url].authHeader;
}

function init(url) {
	if (!systemsMap[url]) {
		systemsMap[url] = {};
	}

	return generateAccessToken(url);
}

async function initComponent(component) {
	if (component.urls) {
		component.endpoints = component.urls.split(/\s*,\s*/);
		const promiseList = component.endpoints.map(itm => init(itm));

		const results = await Promise.allSettled(promiseList);
		let componentHasErrors = false;
		results.forEach((itm, idx) => {
			if (itm.status === "rejected") componentHasErrors = true;
			else {
				const url = component.endpoints[idx];
				systemsMap[url].authHeader = "Bearer " + itm.value;
			}
		});
		if (componentHasErrors) {
			showErrorMessage(genericErrorMsg, component);
		}
	} else if (component.url) {
		const authHeader = await init(component.url, component);
		systemsMap[component.url].authHeader = "Bearer " + authHeader;
	} else {
		showError("Invalid component configuration", component);
	}
}

async function generateAccessToken(url) {
	try {
		const accessToken = await generateJWT({ url });
		return accessToken;
	} catch (err) {
		logError(err.body?.message);
		return Promise.reject(err.body?.message);
	}
}

function generateKey(prefix = "k") {
	return `${prefix}_${Math.random()
		.toString(36)
		.substr(2, 9)}`;
}

function decodeHTML(value) {
	if (value) {
		if (value.indexOf("&") !== -1) {
			const doc = new DOMParser().parseFromString(value, "text/html");
			return doc.documentElement.textContent;
		}
	}
	return value;
}

function showErrorMessage(msg, component, mode = {}) {
	let evt = new ShowToastEvent({
		title: "Error",
		message: msg,
		variant: "error",
		mode: "sticky",
		...mode
	});
	component.dispatchEvent(evt);
}

function showError(err, component, mode = {}) {
	let evt;
	if (typeof err === "string") {
		evt = new ShowToastEvent({
			title: "Error",
			message: err,
			variant: "error",
			mode: "sticky",
			...mode
		});
	} else if (!err || !err.errors || err.errors.length === 0) {
		evt = new ShowToastEvent({
			title: "Error",
			message: genericErrorMsg,
			variant: "error",
			mode: "sticky",
			...mode
		});
	} else {
		evt = new ShowToastEvent({
			title: `Error, ID: ${err.errors[0].ID}`,
			message: err.errors[0].message,
			variant: "error",
			mode: "sticky",
			...mode
		});
	}
	component.dispatchEvent(evt);
}

function getWorkList(url, dataPage = "D_Worklist") {
	return getDataPage(url, dataPage, { Work: true });
}

function showMessage(
	title,
	message,
	component,
	variant = "success",
	mode = "dismissable"
) {
	let evt = new ShowToastEvent({
		title,
		message,
		variant,
		mode
	});
	component.dispatchEvent(evt);
}

function debounce(func, wait, immediate) {
	let timeout;
	return () => {
		const context = this;
		const args = arguments;

		const later = function () {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		const callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
}

function logError(error) {
	debugger;
	console.log(error);
}

function prompt(msg) {
    return window.prompt(msg);
}

function confirm(msg) {
    return window.confirm(msg);
}

function getWorkBasket(url, WorkBasket, dataPage = "D_WorkBasket") {
	if (!WorkBasket) return {};
	return getDataPage(url, dataPage, { WorkBasket });
}

function getUrlParams(params = {}) {
	let urlParams = "";
	for (let param in params) {
		if (Object.prototype.hasOwnProperty.call(params, param)) {
			urlParams += `${param}=${params[param]}&`;
		}
	}
	return urlParams ? "?" + urlParams : urlParams;
}

function getDataPage(url, id, params = {}) {
	let endpoint = url + endpoints.DATA + "/" + id;
	url = endpoint;
	let urlParams = getUrlParams(params);

	url = endpoint + urlParams;
	return makeRequest(url, "GET");
}

function getCaseTypes(url) {
	let endpoint = url + endpoints.CASETYPES;
	return makeRequest(endpoint, "GET");
}

function createCase(url, body) {
	let endpoint = url + endpoints.CASES;
	return makeRequest(endpoint, "POST", body);
}

function getCaseTypeDetails(url, id) {
	let endpoint = url + endpoints.CASETYPES + "/" + id;
	return makeRequest(endpoint, "GET");
}

function getCase(url, id) {
	let endpoint = url + endpoints.CASES + "/" + id;
	return makeRequest(endpoint, "GET");
}

function getNextAssignment(url) {
	let endpoint = encodeURI(url + endpoints.ASSIGNMENTS + "/next");
	return makeRequest(endpoint, "GET");
}

function getAssignment(url, id) {
	let endpoint = encodeURI(url + endpoints.ASSIGNMENTS + "/" + id);
	return makeRequest(endpoint, "GET");
}

function performAction(url, id, actionID, body) {
	let endpoint = encodeURI(
		url + endpoints.ASSIGNMENTS + "/" + id + `?actionID=${actionID}`
	);
	return makeRequest(endpoint, "POST", body);
}

function performRefreshOnAssignment(url, id, actionID, body) {
	let refreshFor = "";
	if (body && body.refreshFor) {
		refreshFor = `?refreshFor=${body.refreshFor}`;
		delete body.refreshFor;
	}

	let endpoint = encodeURI(
		url +
		endpoints.ASSIGNMENTS +
		"/" +
		id +
		"/" +
		endpoints.ACTIONS +
		"/" +
		actionID +
		"/" +
		endpoints.REFRESH +
		refreshFor
	);
	return makeRequest(endpoint, "PUT", body);
}

function updateCase(url, id, body, etag) {
	let endpoint = url + endpoints.CASES + "/" + id;
	return makeRequest(endpoint, "PUT", body, etag);
}

function getFieldsForAssignment(url, assignmentId, actionId) {
	let endpoint =
		url +
		endpoints.ASSIGNMENTS +
		"/" +
		assignmentId +
		"/" +
		endpoints.ACTIONS +
		"/" +
		actionId;

	return makeRequest(endpoint, "GET");
}

function getView(url, caseId, viewId) {
	let endpoint =
		url + endpoints.CASES + "/" + caseId + "/" + endpoints.VIEWS + "/" + viewId;
	return makeRequest(endpoint, "GET");
}

function getPage(url, caseId, pageId) {
	let endpoint =
		url + endpoints.CASES + "/" + caseId + "/" + endpoints.PAGES + "/" + pageId;
	return makeRequest(endpoint, "GET");
}

function getAttachments(url, caseId) {
	let endpoint = url + endpoints.CASES + "/" + caseId + "/attachments";
	return makeRequest(endpoint, "GET");
}

function deleteAttachment(url, attachId) {
	let endpoint = url + "/attachments/" + attachId;
	return makeRequest(endpoint, "DELETE");
}

function downloadAttachment(url, attachId) {
	let endpoint = url + "/attachments/" + attachId;
	return makeRequest(endpoint, "GET");
}

function getOperator(url) {
	return getDataPage(url, "D_OperatorID");
}

async function attachFile(url, caseId, file) {
	let endpoint = `${url}attachments/upload`;
	let body = new FormData();
	body.append("context", caseId);
	body.append("content", file);	
	const responseData = await makeRequest(endpoint, "POST", body, null, true);
	const { ID } = responseData;
	if (ID) {
		body = {
			"attachments": [
				{
					"type": "File",
					"category": "File",
					"name": file.name,
					ID,
					"url": ""
				}
			]
		};
		endpoint = `${url}cases/${caseId}/attachments`;
		return makeRequest(endpoint, "POST", body);
	}
	return Promise.reject("Couldn't attach file");
}

async function makeRequest(endpoint, method, data, etag, isFormData, retryFlag) {
	const key = endpoint.match(/.*\/api\/v[^/]*\//)[0];

	const config = {
		method: method,
		headers: { authorization: systemsMap[key].authHeader },
		redirect: "follow",		
	};
	if (method === "POST" || method === "PUT") {		
		if (etag) config.headers["if-match"] = etag;	
		if (isFormData) config.body = data;
		else {
			config.headers["content-type"] = "application/json";
			config.body = JSON.stringify(data);
		}
	}	
	try {
		const response = await fetch(endpoint, config);
		if (!retryFlag && response.status === 401) {
			await generateAccessToken(key);
			return await makeRequest(endpoint, method, data, etag, isFormData, true)
		}
		if (response.status === 204) return Promise.resolve();		
		if (response.status >= 200 && response.status < 300) {
			const contentType = response.headers.get("content-type");
			if (contentType && contentType.toLowerCase().indexOf("application/json") !== -1) {
				const responseData = await response.json();
				if (response.headers && response.headers.get("etag")) {					
					responseData.etag = response.headers.get("etag");					
				}
				return responseData;
			} else if (contentType && contentType.toLowerCase().indexOf("text") !== -1) {
				return response.text();
			}
		}
		return Promise.reject(await response.json());
	} catch (err) {
		return Promise.reject(err);
	}
}
