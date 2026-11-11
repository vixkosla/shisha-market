import { legalConfiguration } from "./legal-policy";

type Section = { heading: string; paragraphs: string[] };

export const legalDocumentsEn = (): Record<
  "terms" | "rules" | "privacy" | "cookies" | "contact",
  Section[]
> => {
  const c = legalConfiguration();
  const operator = c.operator || "Operator not yet specified";
  const address = c.address || "Address not yet specified";
  const contact =
    c.email || "No working email yet; external requests are not accepted";
  return {
    terms: [
      {
        heading: "Purpose of the platform",
        paragraphs: [
          "Shisha Market provides a free way to post and read private listings in countries and categories open for publication. This is an agreement on the use of the site, not a contract for the sale of goods.",
          "The platform does not take orders or payments for goods, is not a party to a transaction between members, does not arrange delivery, and does not provide escrow, safe deals or performance guarantees. Users communicate and make decisions outside the site on their own. These terms do not relieve the operator of its own statutory duties.",
        ],
      },
      {
        heading: "Participation and rules",
        paragraphs: [
          "Registration and publication are available to participants aged 18 and over. Age is confirmed by the user's statement; the site does not verify documents. Registration is not required to read the documents.",
          "The author posts only accurate information about their own personal item, follows the publication rules and respects the rights of others. Presenting commercial trade as a private listing is prohibited. Accounts may not be transferred to others, restrictions may not be circumvented, and unsolicited advertising may not be sent to members.",
        ],
      },
      {
        heading: "Moderation and requests",
        paragraphs: [
          "Before a moderator approves it, a listing is closed to outsiders. The operator may refuse publication or hide a listing in case of a rules violation, a substantiated complaint or a demand from a competent authority. The decision can be appealed through the requests section.",
          "Moderation checks the content of the publication but does not verify the author's identity, the existence or quality of the item, ownership or the safety of the deal. The author may withdraw their listing in the account area; withdrawal is not the same as deletion of all data.",
        ],
      },
      {
        heading: "User materials",
        paragraphs: [
          "Rights to text and photographs remain with their rightholders. The author grants the operator a simple, royalty-free permission to store, technically transform and display the materials on the site for publication and moderation of the listing. Promotion in third-party communities requires a separate basis: with the author's consent an approved listing may be posted in the project's VK community (photo, title, price, city and a link to the card); form contacts are not carried into the post and posting ends together with the listing.",
          "Do not upload other people's photographs without permission, documents, correspondence, images of persons, phone numbers, home addresses or other personal data in the listing text and photos. Contact is provided only in a separate field with separate consent.",
        ],
      },
      {
        heading: "Changes and applicable law",
        paragraphs: [
          "The date and version of the terms are shown on the page. A new version applies to new actions after acceptance and does not replace consent already recorded. Paid services, expansion of geography and changes to the platform's role require a separate decision and updated terms.",
          "Neither this agreement nor the choice of domain or hosting overrides mandatory rules of applicable law and users' rights. Disputes and requests are handled under applicable law; no mandatory waiver of judicial protection is established.",
        ],
      },
    ],
    rules: [
      {
        heading: "Limited pilot",
        paragraphs: [
          "During the pilot, only listings of one's own pre-owned items from private adult participants are accepted. The country means the location of the item, not the author's citizenship. Category names in the test interface do not imply permission for their public circulation.",
          "Publication opens separately for each country and category after the scenario is checked. The entire CIS is not considered automatically connected. Labels such as 'used', '18+', 'private seller', free placement and a link to a messenger do not make a prohibited offer permissible.",
        ],
      },
      {
        heading: "What is not accepted",
        paragraphs: [
          "Tobacco and nicotine-containing products, smoking mixtures, vapes and electronic cigarettes, liquids and consumables for them are prohibited; narcotic, counterfeit, stolen and other prohibited goods are prohibited.",
          "Commercial catalogs, batches of identical goods, constant assortment replenishment, pre-orders, purchase for resale, store advertising, discounts, promo codes and wholesale offers are not accepted. A prohibited item may not be renamed as an accessory or a decorative item.",
          "Hookahs, bowls and specialized accessories are not automatically considered permitted: they require a separate category approval in the selected country. The moderator checks the actual item and purpose, including photographs.",
        ],
      },
      {
        heading: "Listing content",
        paragraphs: [
          "One publication describes one personal item. State the actual condition, defects, your own photograph, city and country. In the current interface the price is expressed in rubles; the site does not convert money or process payments.",
          "Personal data in free text and images is prohibited. For contact, use only a link to your own profile in the dedicated field. Consent to its publication is given separately; the sign-in email and the full name from the consent are not published.",
          "Automatic word checks only help the moderator and do not confirm the legality of a listing. Every publication passes manual review; the restrictions also apply to direct requests to the server.",
        ],
      },
      {
        heading: "Safety and complaints",
        paragraphs: [
          "The site has no payment or delivery service. A message asking you to pay for a 'Shisha Market safe deal' does not match the platform's functions. Do not share sign-in codes, card details or copies of documents with other members.",
          "The report link opens the requests form. Requests and the reporter's identity are not published and are not passed to the listing author through the site. Without an account, you can write to the operator at the contact in the operator section.",
        ],
      },
    ],
    privacy: [
      {
        heading: "Operator and scope",
        paragraphs: [
          `Operator: ${operator}. Address: ${address}. Requests: ${contact}.`,
          "The policy applies to Shisha Market, not to sites reached through external links. Until the details and processing scheme are filled in, public registration is closed. Synthetic data is used for local checks.",
        ],
      },
      {
        heading: "Data and purposes",
        paragraphs: [
          "For sign-in we process email, the internal account identifier, account name, email confirmation details, sessions, IP address and browser parameters required for authorization and protection. The one-time code is valid for five minutes; its value is stored as a hash. Email is not shown to visitors.",
          "For publication we process details and photographs of the item, country and city, the chosen contact link, authorship, status and moderation decisions. The full name from the separate consent is stored only to record the declaration of will and is not shown in the listing.",
          "For support we store the text of the request, the linked account and listing, time and decision. To confirm consents — the document version, time, selected conditions and details of the corresponding action. Do not send passports, payment details or sensitive information not necessary for the request.",
          "The suggestion form on the requests page accepts the text of an idea and an optional contact without sign-in. A technical fingerprint of the request is stored to limit frequency. This is not registration and not publication of a listing.",
        ],
      },
      {
        heading: "Bases and methods",
        paragraphs: [
          "Separate consent is requested for voluntary processing for registration purposes. Actions necessary for the performance of the agreement with the user and for compliance with legal duties are carried out on the corresponding independent legal basis. Publication of contact and location requires separate consent to dissemination.",
          "Processing is automated with the participation of authorized employees: collection, recording, systematization, storage, clarification, use, provision of access, blocking and deletion. The information is not used for advertising mailings. Complaint decisions are made by a human.",
        ],
      },
      {
        heading: "Where data is processed",
        paragraphs: [
          `Placement: ${c.dataLocation || "the scheme for placing real users' data has not been approved"}.`,
          `Persons engaged in processing, their addresses, countries and purpose: ${c.processors || "the list has not been approved; real external integrations are not enabled until it is filled in"}.`,
          "Cross-border transfer is not permitted by a single general checkbox. Localization, legal bases and notices are checked separately. VK ID is disabled in this pilot; an ordinary community link does not give it access to site accounts. With autoposting enabled, only approved listing data (photo, title, price, city and link) is posted in the project's VK community; the full name, email and form contacts are not transferred there.",
        ],
      },
      {
        heading: "Retention and termination",
        paragraphs: [
          `Approved retention periods by purpose and for backups: ${c.retention || "not defined; this is a blocker for starting public registration"}.`,
          "Withdrawing a listing closes publication and visitors' access to its photographs, but keeps the record for the owner and moderator. An account deletion request is processed separately: the operator verifies the requester and the necessary legal grounds for retention and reports the result. The site does not claim that account deletion is already performed automatically.",
          "When consent to publication is withdrawn through the account area, all of the requester's listings are immediately removed from public access. Withdrawal of consent to processing, correction, access and deletion can be requested through the requests section or the operator's email. Necessary processing may continue only if there is an independent legal basis.",
        ],
      },
      {
        heading: "Protection and rights",
        paragraphs: [
          "Access to closed information is checked on the server. Photographs are not served to guests before publication or after withdrawal; image metadata is removed. Moderator rights are not granted on self-registration. These measures are not a promise of absolute security.",
          "The user may request information about processing, correction, termination of unlawful processing and deletion, withdraw consent, and apply to a competent authority or court. Requests are fulfilled within the periods provided by applicable law. Mandatory rights cannot be revoked by these rules.",
        ],
      },
    ],
    cookies: [
      {
        heading: "Technical cookies",
        paragraphs: [
          "The site uses Better Auth cookies necessary for sign-in and session protection. The session lasts seven days and may be extended on activity; signing out ends the current session. Cookie names may carry the __Secure- prefix under HTTPS.",
          "Yandex Metrika (counter 113672611) and Google Analytics 4 (stream G-E9YMQQ5CXW) are connected. They set service analytics cookies and count visits, sources, devices and page views to see whether the platform is alive. There are no advertising pixels or advertising cookies. Google Search Console looks at search results and does not set a separate visitor counter. An ordinary external link opens another site where its own rules apply.",
          "Disabling technical cookies in the browser may make sign-in unavailable. An 'agree to everything' banner is not used. A summary of visits is published on the stats page and excluded from indexing.",
        ],
      },
    ],
    contact: [
      {
        heading: "Who runs the platform",
        paragraphs: [
          `Site owner and data operator: ${operator}. Status: self-employed, payer of the professional income tax (Russian Federation).`,
          `Address for requests: ${address}.`,
          `Email: ${contact}.`,
          "Shisha Market is the name of a project, not a fictitious legal entity. Indicating a foreign domain or server does not replace information about the operator.",
        ],
      },
      {
        heading: "How to contact us",
        paragraphs: [
          "The requests section offers a complaint, appeal of a decision, request for access to or correction of data, account deletion and withdrawal of consent to publication. An authorized requester receives a request number; the status and answer are available only to them and a moderator.",
          "A suggestion about the platform can be sent without an account using the form on the requests page. For a letter without an account, provide the link or listing identifier, the substance of the question and a return contact. For personal data questions, add your full name and the list of data concerned. Do not send a copy of your passport without a justified separate request.",
          "When reporting someone else's data or dangerous content, the operator first assesses the need to restrict access, then checks the circumstances and records the decision. The platform does not replace the police, a court or resolution of a deal dispute.",
        ],
      },
    ],
  };
};
