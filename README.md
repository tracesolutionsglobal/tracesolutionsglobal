# Trace Solutions Global website

```
trace-solutions-global/
├── index.html        Homepage
├── robots.txt / sitemap.xml   Help Google find your pages (and skip /admin/)
├── work.html         Our Work: portfolio with filters, live previews and case studies
├── build.html        Concept Builder: step-by-step build tree, summary build line, and the PDF plan
├── admin/
│   └── index.php     Back office: concepts (with PDFs), contact messages, and reviews to approve
└── api/
    ├── config.php    Your settings (edit before going live)
    ├── brief.php     Receives finished concepts, saves the PDF, emails it, sends it on WhatsApp
    ├── pdf.php       Opens a customer's PDF from the signed link in their WhatsApp or email
    ├── contact.php   Receives the homepage contact form
    ├── reviews.php   Collects client reviews; only ones you approve appear on the homepage
    ├── _common.php   Shared helpers (validation, email, WhatsApp, PDF links)
    └── data/         Submissions (JSON) and PDFs, blocked from public access
```

## How the PDF plan works

At the end of the Concept Builder the customer picks how they want their plan:

- **Email**: the server emails them the PDF as an attachment, and sends you a copy.
- **WhatsApp**: if you've connected the WhatsApp Business Cloud API (below), the PDF is sent to their WhatsApp automatically. If not, they tap "Open WhatsApp" and send you a message that contains a private link to their PDF, so it also stays in their chat.
- **Download**: the PDF saves straight to their device.

In every case the concept and PDF are saved, emailed to you, and listed in the back office.
The PDF is generated in the visitor's browser, so nothing extra needs installing on the server.

## Going live

1. Upload the whole folder to a host with PHP 7.4 or newer.
2. `api/config.php` is already set up for **tracesolutionsglobal.com** (site address, emails and a private signing secret). You only need to:
   - set `admin_password` to a strong password of your own (the back office stays locked until you do)
   - create the mailboxes `hello@tracesolutionsglobal.com` (where concepts arrive) and `website@tracesolutionsglobal.com` (the sender) with your host, or change them
3. Make sure `api/data/` is writable by the web server.
4. Turn on SSL (https) for the domain in your hosting panel, so PDF links and forms are secure.
5. Your back office is at **https://tracesolutionsglobal.com/admin/**.

## Optional: send PDFs to WhatsApp automatically

1. Create a WhatsApp Business account at business.facebook.com and add the WhatsApp product (Cloud API).
2. Create a message template named `website_plan` (category: Utility) with:
   - Header: **Document**
   - Body, for example: `Hi {{1}}, here is your website concept plan from Trace Solutions Global. We'll send your fixed-price proposal within 24 hours.`
3. Once Meta approves it, copy your permanent access token and phone number ID into the `whatsapp` section of `api/config.php`.

Until that's set up, the WhatsApp option still works through the "Open WhatsApp" button.

## Notes

- Contact details (WhatsApp +44 7548 692972) live in `TS.site` near the top of the scripts in `index.html` and `build.html`.
- If your host uses Nginx instead of Apache, the `.htaccess` files are ignored: ask your host to block public access to `api/data/` and `api/config.php`.

## Reviews

Clients can leave a star rating and review at the bottom of the homepage. New reviews wait in the
back office (**Reviews** tab) until you press **Approve**; only approved reviews appear on the site,
along with the average rating. You get an email each time a new review comes in.

To show reviews you've already received elsewhere (with the client's permission), add them to
`TS.reviews` near the top of the scripts in `index.html`.

## Offices and phone numbers

The UK and Sri Lanka numbers in "Talk to a real person" are in `TS.site.offices` in `index.html`.
Each number automatically gets WhatsApp, Call and Text buttons.

## Our Work page

Projects live in `TS.portfolio` near the bottom of `work.html`. Copy one entry to add a project; set `status: "live"` and a `url` to show a "View live demo" button.
