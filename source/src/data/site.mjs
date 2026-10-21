// Page list, products and footnotes. Every fact here comes from the
// 2026 Company Profile (Edition 2026, Version 5); the page number is noted beside it.

export const parts = {
  front: 'FRONT MATTER',
  one: 'PART ONE · THE COMPANY',
  two: 'PART TWO · WHAT WE OFFER',
  three: 'PART THREE · HOW WE WORK',
  end: 'END MATTER',
};

// num: the number shown in the curtain, index and chapter rail.
export const pages = [
  { id: 'home', path: '/', num: '01', name: 'Cover', nav: 'Home', part: 'front',
    title: 'Biashara Trading Company Limited · Short-term bridge financing in Kampala',
    description: 'Licensed short-term bridge financing in Kampala since 2014. UGX 1–50M, 2.8% per month on the approved principal, up to 6 months. School fees, salary, asset and business loans.' },
  { id: 'about', path: '/about/', num: '02', name: 'About Biashara', nav: 'About', part: 'one',
    title: 'About Biashara · Biashara Trading Company Limited',
    description: 'Incorporated in 2014 in Kampala to provide accessible, short-term bridge financing. Vision, mission, quality statement and the five core values.' },
  { id: 'loans', path: '/loans/', num: '03', name: 'Loan Solutions', nav: 'Loans', part: 'two',
    title: 'Loan Solutions & Product Matrix · Biashara Trading Company Limited',
    description: 'Four short-term products: School Fees, Salary, Asset Financing and Business Loans. UGX 1M–50M, 2.8% per month, a maximum term of 6 months.' },
  { id: 'how-we-lend', path: '/how-we-lend/', num: '04', name: 'How We Lend', nav: 'How we lend', part: 'three',
    title: 'How We Lend · Eligibility, documents and credit assessment · Biashara',
    description: 'A four-step path from enquiry to disbursement, who is eligible, the documents usually requested, and the five standards applied to every file.' },
  { id: 'terms', path: '/terms/', num: '05', name: 'Terms & Charges', nav: 'Terms', part: 'two',
    title: 'Terms & Charges · Responsible Lending · Biashara Trading Company Limited',
    description: 'What a facility costs, how it is communicated and what is never charged. 2.8% per month on the approved principal; applying is free.' },
  { id: 'who-we-serve', path: '/who-we-serve/', num: '06', name: 'Who We Serve', nav: 'Who we serve', part: 'two',
    title: 'Who We Serve · Biashara Trading Company Limited',
    description: 'Entrepreneurs, salaried clients, companies and NGOs, and growing businesses across urban, semi-urban and rural Uganda.' },
  { id: 'team', path: '/team/', num: '07', name: 'Leadership & Organisation', nav: 'Team', part: 'one',
    title: 'Leadership & Organisation · Biashara Trading Company Limited',
    description: 'The Board, executive leadership, specialist support, management and staff of Biashara Trading Company Limited.' },
  { id: 'licence', path: '/licence/', num: '08', name: 'Money Lending Licence', nav: 'Licence', part: 'end',
    title: 'Money Lending Licence 1451/ML · Biashara Trading Company Limited',
    description: 'The 2026 reference copy of Money Lending Licence 1451/ML issued by the Ministry of Finance, Planning and Economic Development, with annual renewal and verification details.' },
  { id: 'faq', path: '/faq/', num: '09', name: 'Questions', nav: 'FAQ', part: 'end',
    title: 'Questions & Answers · Biashara Trading Company Limited',
    description: 'Answers drawn from the 2026 Company Profile: cost to apply, review time, products, range, term, documents, security, licence and office hours.' },
  { id: 'contact', path: '/contact/', num: '10', name: 'Contact', nav: 'Contact', part: 'end',
    title: 'Contact · Conrad Plaza, Entebbe Road, Kampala · Biashara',
    description: 'Conrad Plaza, Plot 24/25 Entebbe Road, Second Floor, Suite 2, Kampala. +256 702 634 848 · +256 392 960 002 · inquiries@biasharafinance.com. Monday–Friday 8:00 AM–4:00 PM.' },
  { id: 'apply', path: '/apply/', num: '11', name: 'Apply', nav: 'Apply', part: 'end',
    title: 'Apply · Assemble your loan file · Biashara Trading Company Limited',
    description: 'Assemble your loan file in five steps: product, amount and term, your details, purpose and documents, review. Applying is free.' },
  { id: 'profile', path: '/profile/', num: '12', name: 'Company Profile', nav: 'Profile', part: 'end',
    title: 'Company Profile 2026 · Biashara Trading Company Limited',
    description: 'The full 2026 Company Profile of Biashara Trading Company Limited as a printable, accessible web page.' },
  { id: 'privacy', path: '/privacy/', num: '13', name: 'Privacy', nav: 'Privacy', part: 'end',
    title: 'Privacy · Biashara Trading Company Limited',
    description: 'How client information is handled: used only for legitimate assessment and servicing purposes, and handled confidentially.' },
];

// Products (pages 13 and 14).
export const products = [
  { slug: 'school-fees', n: '01', name: 'School Fees Loans', short: 'School Fees',
    desc: 'Short-term finance for eligible clients to meet school-fee obligations and manage education cash flow across a term.',
    purpose: 'Termly school-fee obligations', security: 'As required by the facility', icon: 'book' },
  { slug: 'salary', n: '02', name: 'Salary Loans', short: 'Salary',
    desc: 'Short-term facilities for eligible salaried clients with approved personal or household needs, repaid against verified income.',
    purpose: 'Approved personal or household needs', security: 'Verified income; security if required', icon: 'wallet' },
  { slug: 'asset', n: '03', name: 'Asset Financing', short: 'Asset Financing',
    desc: 'Finance for approved vehicle, land and other productive asset purchases, structured within a maximum six-month term.',
    purpose: 'Vehicle, land and other approved productive assets', security: 'Financed asset and/or other approved security', icon: 'key' },
  { slug: 'business', n: '04', name: 'Business Loans', short: 'Business',
    desc: 'Working-capital finance for stock purchase, cash-flow gaps and other approved business needs.',
    purpose: 'Stock, cash-flow gaps and working capital', security: 'As required by the facility', icon: 'store' },
];

// Footnotes. Text is quoted from the profile; `src` is the page it comes from.
export const notes = {
  figures: { src: 2, text: 'Every figure in this profile — the facility range, the interest rate, the maximum term — is the standard published term in force at the edition date. Individual client terms are confirmed in writing at approval and may differ from these figures.' },
  assessed: { src: 6, text: 'Approved amount, tenure, security and repayment arrangements depend on credit assessment and approval. An application does not guarantee a facility.' },
  interest: { src: 15, text: '2.8% per month applies across all four products, calculated on the approved principal.' },
  charges: { src: 15, text: 'We have no hidden charges. Every applicable loan fee, including any processing fee, is listed on a written schedule and applies only after you accept it. Access to service, application and credit assessment require no fees or commissions.' },
  review: { src: 23, text: 'A four-working-hour review is our service target for complete files during office hours. Final approval and release of funds depend on verification and fulfilment of all conditions.' },
  officehours: { src: 21, text: 'Office hours apply. Final approval and disbursement follow all required checks and conditions.' },
  deadline: { src: 19, text: 'We handle complete files promptly and work towards your target date. Review time runs during office hours. Final approval and disbursement remain subject to verification, accepted terms and completion of all conditions.' },
  licence: { src: 24, text: 'Biashara renews its money lending licence every year. To verify the current licence, kindly contact the Board of Directors.' },
  portraits: { src: 10, text: 'Specialist portraits reconstructed from supplied references.' },
  eligibility: { src: 17, text: 'Eligibility is assessed on repayment capacity, purpose and security where required — not on the category a client falls into.' },
  documents: { src: 20, text: 'These lists are the usual starting point; more may be requested depending on the product and amount.' },
  operating: { src: 9, text: 'The company serves eligible clients across urban, semi-urban and rural Uganda, subject to its operating capacity and approved requirements.' },
};
