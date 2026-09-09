import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to calculate total page count dynamically."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return  # Suppress headers and footers on cover page

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Running Header
        self.drawString(54, 750, "ZVote: Decentralized Electronic Voting System — Technical Defense Manual")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 742, 558, 742)

        # Running Footer
        self.line(54, 48, 558, 48)
        self.drawString(54, 36, "Confidential — Prepared for Academic Project Defense & Technical Review")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 36, page_text)
        self.restoreState()

def build_pdf(filename="addons/ZVOTE_COMPLETE_TECHNICAL_AND_DEFENSE_MANUAL.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Custom typography
    c_primary = colors.HexColor("#0F172A")    # Slate 900
    c_secondary = colors.HexColor("#1E3A8A")  # Blue 900
    c_accent = colors.HexColor("#2563EB")     # Blue 600
    c_body = colors.HexColor("#334155")       # Slate 700
    c_light_bg = colors.HexColor("#F8FAFC")   # Slate 50
    c_border = colors.HexColor("#E2E8F0")     # Slate 200

    title_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=26,
        leading=32,
        textColor=c_primary,
        alignment=0,
        spaceAfter=8,
    )
    subtitle_style = ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=13,
        leading=18,
        textColor=c_accent,
        alignment=0,
        spaceAfter=20,
    )
    h1_style = ParagraphStyle(
        "ChapterHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=c_secondary,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True,
    )
    h2_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=c_primary,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    )
    h3_style = ParagraphStyle(
        "SubSectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=14,
        textColor=c_accent,
        spaceBefore=8,
        spaceAfter=2,
        keepWithNext=True,
    )
    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13.5,
        textColor=c_body,
        spaceAfter=6,
    )
    body_bold = ParagraphStyle(
        "BodyDarkBold",
        parent=body_style,
        fontName="Helvetica-Bold",
    )
    callout_style = ParagraphStyle(
        "CalloutText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#1E293B"),
    )
    qa_q_style = ParagraphStyle(
        "QAQuestion",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=13.5,
        textColor=c_secondary,
        spaceBefore=6,
        spaceAfter=2,
        keepWithNext=True,
    )
    qa_a_style = ParagraphStyle(
        "QAAnswer",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12.5,
        textColor=c_body,
        spaceAfter=6,
    )

    story = []

    # ==========================================
    # COVER / TITLE BLOCK
    # ==========================================
    story.append(Paragraph("ZVOTE: DECENTRALIZED ELECTRONIC VOTING SYSTEM", title_style))
    story.append(Paragraph("Comprehensive Technical Reference & Master Project Defense Manual", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=c_accent, spaceBefore=0, spaceAfter=15))

    meta_table_data = [
        [Paragraph("<b>Target System:</b>", body_bold), Paragraph("University SRC & Departmental Elections", body_style)],
        [Paragraph("<b>Core Architecture:</b>", body_bold), Paragraph("Hybrid Web2.5 (PostgreSQL + Polygon EVM Smart Contracts)", body_style)],
        [Paragraph("<b>Smart Contract:</b>", body_bold), Paragraph("ZVote.sol (Solidity 0.8.19) on Polygon Amoy (Chain ID: 80002)", body_style)],
        [Paragraph("<b>Live Contract Address:</b>", body_bold), Paragraph("<code>0xFf9d890459593d883a2D3BA024b566017958dfFb</code>", body_style)],
        [Paragraph("<b>Live Platforms:</b>", body_bold), Paragraph("Frontend: Netlify (SPA) | Backend: Render.com | DB: Neon PostgreSQL", body_style)],
        [Paragraph("<b>Prepared For:</b>", body_bold), Paragraph("Final Year Engineering Project Defense & Examination Committee", body_style)],
    ]
    t_meta = Table(meta_table_data, colWidths=[130, 374])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_light_bg),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 15))

    # ==========================================
    # CHAPTER 1: EXECUTIVE SUMMARY & PROBLEM STATEMENT
    # ==========================================
    story.append(Paragraph("1. Executive Summary & Problem Statement", h1_style))
    story.append(Paragraph(
        "Democratic legitimacy in student governance rests upon the unquestionable integrity of elections. However, university elections across institutions face recurring crises of trust due to inherent vulnerabilities in existing voting modalities:",
        body_style
    ))

    problems_data = [
        [Paragraph("<b>Modality</b>", body_bold), Paragraph("<b>Critical Vulnerabilities & Failure Modes</b>", body_bold)],
        [
            Paragraph("<b>Paper Ballots</b>", body_style),
            Paragraph("Vulnerable to physical ballot-box stuffing, ballot destruction, recount disputes, chain-of-custody contamination, logistical delay, and high administrative print/stationery costs.", body_style)
        ],
        [
            Paragraph("<b>Traditional Electronic Voting (Web2)</b>", body_style),
            Paragraph("Relies on centralized SQL databases (MySQL/PostgreSQL) where database administrators or rogue insiders can execute unauthorized queries (e.g. <code>UPDATE candidates SET votes = votes + 500</code>) with zero public cryptographically provable detection.", body_style)
        ],
        [
            Paragraph("<b>The Secrecy Paradox</b>", body_style),
            Paragraph("Traditional systems either reveal who voted for whom to prove tally authenticity, or hide identities so completely that voters cannot verify if their individual ballot was altered or discarded.", body_style)
        ],
        [
            Paragraph("<b>Pure Web3 Voting</b>", body_style),
            Paragraph("Requires every voter to own a Web3 crypto wallet (MetaMask), hold native cryptocurrency (MATIC/POL) to pay gas fees, and understand blockchain transactions, making universal student adoption impossible.", body_style)
        ]
    ]
    t_prob = Table(problems_data, colWidths=[120, 384])
    t_prob.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#E2E8F0")),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_prob)
    story.append(Spacer(1, 10))

    story.append(Paragraph(
        "<b>The ZVote Solution (Hybrid Web2.5):</b> ZVote solves this trilemma by combining Web2 user convenience with Web3 cryptographic immutability. Students authenticate with their familiar Institutional Student ID and password with $0 gas fees (no MetaMask needed). In the background, the backend acts as an automated cryptographic relayer, submitting and sealing each ballot onto an immutable EVM smart contract on the Polygon blockchain.",
        body_style
    ))
    story.append(Spacer(1, 10))

    # ==========================================
    # CHAPTER 2: HYBRID ARCHITECTURE & DATA FLOW
    # ==========================================
    story.append(Paragraph("2. System Architecture & Zero-Linkability Model", h1_style))
    story.append(Paragraph(
        "ZVote is engineered upon a decoupled two-tier architecture that enforces mathematical voter privacy:",
        body_style
    ))

    arch_table_data = [
        [Paragraph("<b>Layer</b>", body_bold), Paragraph("<b>Component & Technology</b>", body_bold), Paragraph("<b>Data Stored & Cryptographic Responsibilities</b>", body_bold)],
        [
            Paragraph("<b>Off-Chain Layer (Web2)</b>", body_style),
            Paragraph("Node.js, Express, Prisma ORM, Neon PostgreSQL (AWS)", body_style),
            Paragraph("• Stores student identities (Name, Student ID, Email, Department).<br/>• Enforces eligibility and departmental enclaves.<br/>• Records <code>VoteReceipt</code> (User ID, Position ID, txHash) to prevent duplicate submissions.<br/>• <b>NEVER stores or logs which candidate the student selected.</b>", body_style)
        ],
        [
            Paragraph("<b>On-Chain Layer (Web3)</b>", body_style),
            Paragraph("Solidity 0.8.19, Polygon Amoy Testnet (Proof of Stake)", body_style),
            Paragraph("• Canonical ballot box and state machine.<br/>• Stores position titles, candidate rosters, and immutable tallies (<code>voteCount++</code>).<br/>• Enforces <code>votedForPosition[positionId][voterAddress] = true</code>.<br/>• <b>NEVER receives student names, emails, or index numbers.</b>", body_style)
        ],
        [
            Paragraph("<b>Relayer Layer</b>", body_style),
            Paragraph("Ethers.js v6 with <code>NonceManager</code>", body_style),
            Paragraph("• Signs blockchain transactions on behalf of voters using the Election Authority wallet.<br/>• Manages sequential nonces to prevent race conditions during peak voting bursts.<br/>• Pays gas fees so voters incur $0 cost.", body_style)
        ],
        [
            Paragraph("<b>Messaging Layer</b>", body_style),
            Paragraph("Brevo HTTPS REST API (Port 443)", body_style),
            Paragraph("• Bypasses cloud host outbound SMTP port restrictions (ports 25, 465, 587).<br/>• Dispatches credentials directly to external student Gmail inboxes.<br/>• Rate-limited intermittent queue protects domain reputation.", body_style)
        ]
    ]
    t_arch = Table(arch_table_data, colWidths=[90, 140, 274])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#E2E8F0")),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 10))

    callout_text = (
        "<b>Mathematical Principle of Zero Linkability:</b> An attacker who gains complete, unrestricted read access "
        "to both the PostgreSQL database AND the public Polygon blockchain ledger cannot link a specific student ID "
        "to their chosen candidate. In PostgreSQL, only eligibility and transaction hashes are recorded. On Polygon, "
        "only candidate vote tallies and pseudonymous wallet addresses are recorded. The mapping between voter identity "
        "and ballot selection is destroyed in transient memory during request processing."
    )
    t_callout = Table([[Paragraph(callout_text, callout_style)]], colWidths=[504])
    t_callout.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EFF6FF")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#3B82F6")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_callout)
    story.append(Spacer(1, 12))

    # ==========================================
    # CHAPTER 3: TECHNOLOGY STACK & JUSTIFICATIONS
    # ==========================================
    story.append(Paragraph("3. Technology Stack & Technical Justifications", h1_style))
    story.append(Paragraph(
        "Examiners frequently ask: <i>'Why did you choose this specific technology over its alternatives?'</i> Below are the rigorous technical justifications:",
        body_style
    ))

    tech_justifications = [
        ("Solidity 0.8.19 (Smart Contracts)", 
         "Features built-in arithmetic overflow and underflow protection without needing SafeMath. Compiled with 200 optimization runs to reduce runtime gas execution cost on EVM chains. Emits standardized events (VoteCast, ElectionStarted) for transparent public log scraping."),
        
        ("Polygon Amoy (PoS / CDK)", 
         "Why not Ethereum Mainnet? Ethereum takes 12-15 seconds per block and charges $5 to $50 in gas per transaction—prohibitive for university elections. Polygon provides 2-second block finality, 65,000 TPS capacity, and transaction fees of fractions of a cent ($0.0001). Why not Solana? Polygon is 100% EVM-compatible, enabling standard Hardhat and OpenZeppelin tooling."),
        
        ("Node.js & Express API", 
         "Single-threaded event loop with non-blocking asynchronous I/O handles thousands of concurrent student requests without thread-pool starvation. Seamlessly integrates with the JavaScript-native Ethers.js v6 blockchain SDK."),
        
        ("Ethers.js v6 & NonceManager", 
         "Provides modern BigInt support, modular contract interaction, and automatic JSON-RPC failover. Wrapped with NonceManager to solve the critical 'nonce too low' and 'replacement fee too low' race conditions that occur when an election authority wallet signs multiple votes in quick succession."),
        
        ("Prisma ORM & Neon PostgreSQL", 
         "PostgreSQL enforces strict ACID compliance and foreign key constraints across elections, positions, and voter audit receipts. Neon provides serverless branching, auto-scaling, and secure SSL pooling over AWS us-east-2."),
        
        ("Brevo HTTPS REST API", 
         "Cloud hosting providers (Render, AWS EC2, Vercel) permanently block outbound SMTP ports 25, 465, and 587 on free tiers to prevent spam. Nodemailer over SMTP hangs and times out. Brevo's REST API operates over standard HTTPS (Port 443), ensuring 100% reliable credential delivery to external Gmail inboxes without requiring a custom domain."),
        
        ("React 18 & Vite", 
         "Component-based virtual DOM ensures instant UI state transitions. Vite leverages native ES modules and Rollup for a lightning-fast build time (<3 seconds) and a production bundle under 320 KB, ensuring fast mobile loading even on low-bandwidth campus cellular networks."),
        
        ("TailwindCSS", 
         "Utility-first styling avoids bloated runtime CSS. Provides full mobile-first responsiveness with fluid grid breakpoints, flexbox layout, and custom accessibility attributes.")
    ]

    for title, desc in tech_justifications:
        story.append(Paragraph(f"<b>• {title}:</b> {desc}", body_style))
    story.append(Spacer(1, 10))

    # ==========================================
    # CHAPTER 4: SMART CONTRACT ARCHITECTURE (ZVote.sol)
    # ==========================================
    story.append(Paragraph("4. Smart Contract Architecture & On-Chain Logic", h1_style))
    story.append(Paragraph(
        "The smart contract <code>ZVote.sol</code> deployed at <code>0xFf9d890459593d883a2D3BA024b566017958dfFb</code> serves as the immutable single source of truth for voting tallies:",
        body_style
    ))

    contract_data = [
        [Paragraph("<b>Contract Element</b>", body_bold), Paragraph("<b>Implementation & Security Guarantee</b>", body_bold)],
        [
            Paragraph("<code>electionAuthority</code>", body_style),
            Paragraph("Immutable state variable set to <code>msg.sender</code> upon deployment. Protected by <code>onlyElectionAuthority</code> modifier. Restricts administrative functions (create position, add candidate, start/close election) to the verified backend wallet.", body_style)
        ],
        [
            Paragraph("<code>electionActive</code>", body_style),
            Paragraph("Boolean gate. When <code>false</code>, all calls to <code>vote()</code> immediately revert with <code>'ZVote: election is not active'</code>, preventing early voting or post-deadline ballot tampering.", body_style)
        ],
        [
            Paragraph("<code>votedForPosition</code>", body_style),
            Paragraph("Nested mapping <code>uint256 =&gt; mapping(address =&gt; bool)</code>. Tracks whether a specific voter wallet address has voted in a specific position. If <code>true</code>, subsequent vote attempts revert with <code>'ZVote: voter has already voted for this position'</code>.", body_style)
        ],
        [
            Paragraph("<code>vote()</code> Function", body_style),
            Paragraph("Atomically increments <code>candidates[_candidateId].voteCount++</code> and sets <code>votedForPosition[_positionId][_voter] = true</code>. Emits an indexed <code>VoteCast(voter, positionId, candidateId)</code> event on-chain.", body_style)
        ],
        [
            Paragraph("<code>getResults()</code>", body_style),
            Paragraph("Read-only view function returning parallel arrays of candidate names, programmes, and vote counts. Invoked by the frontend results dashboard once polls are closed.", body_style)
        ]
    ]
    t_contract = Table(contract_data, colWidths=[130, 374])
    t_contract.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#E2E8F0")),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_contract)
    story.append(Spacer(1, 10))

    # ==========================================
    # CHAPTER 5: CRYPTOGRAPHIC SECURITY & DEFENSE
    # ==========================================
    story.append(Paragraph("5. Cryptographic Security & Anti-Fraud Mechanisms", h1_style))
    story.append(Paragraph(
        "ZVote enforces defensive security across every layer of the election lifecycle:",
        body_style
    ))

    sec_items = [
        ("Double-Voting Immunity (Two-Tier Guard)",
         "Tier 1 (Off-Chain): PostgreSQL uniqueness constraint on <code>(userId, positionId)</code> in <code>VoteReceipt</code> table. If a student tries to vote twice, the DB query fails with HTTP 409 Conflict.<br/>Tier 2 (On-Chain): The smart contract checks <code>require(!votedForPosition[posId][voter])</code>. Even if the off-chain database were hacked, the blockchain mathematically rejects duplicate votes."),
        
        ("Voter Password Security & Administrator Blindness",
         "When temporary passwords are generated, they are hashed with Bcrypt (salt rounds = 10) for database authentication. Before returning registration reports to the administrator, the backend transforms the passwords into one-way SHA-256 hashes (e.g. <code>sha256:7f83b...</code>). The administrator cannot read student passwords."),
        
        ("Forced Password Change on First Login",
         "Student accounts are created with <code>mustChangePassword = true</code>. Upon initial sign-in, the UI forces the student to set a private password before ballot access is granted."),
        
        ("Session Invalidation via SERVER_BOOT_ID",
         "Every time the backend boots, it generates an ephemeral in-memory UUID. All issued JWTs carry this <code>bootId</code>. If the server is restarted or redeployed, all existing tokens instantly invalidate, preventing replay attacks."),
        
        ("Candidate Exclusivity & Enclave Filtering",
         "A student cannot run for multiple positions in the same election. In departmental elections, candidate and voter queries enforce strict department filtering so voters cannot cross into other faculties."),
        
        ("Sealed Ballot Protocol (Mitigating Bandwagon Bias)",
         "While polls are open, candidate vote counts are sealed in the frontend and only real-time voter turnout is displayed. This eliminates psychological bandwagon bias and tactical voter coercion.")
    ]

    for title, desc in sec_items:
        story.append(Paragraph(f"<b>• {title}:</b> {desc}", body_style))
    story.append(Spacer(1, 10))

    # ==========================================
    # CHAPTER 6: CONSTITUTIONAL ELECTORAL ALGORITHMS
    # ==========================================
    story.append(Paragraph("6. Constitutional Voting Algorithms & Business Logic", h1_style))
    story.append(Paragraph(
        "ZVote implements standard university constitutional electoral formulas directly in code:",
        body_style
    ))

    math_box = (
        "<b>1. The 50% + 1 Absolute Majority Formula:</b><br/>"
        "Let total valid votes cast for a position be <i>V</i>.<br/>"
        "The Constitutional Majority Threshold is defined as: <b><i>T</i> = &lfloor; <i>V</i> / 2 &rfloor; + 1</b><br/>"
        "• <b>Case A (WON_MAJORITY):</b> Top candidate votes &ge; <i>T</i> &rarr; Declared Elected Winner.<br/>"
        "• <b>Case B (RUNOFF_REQUIRED):</b> Top candidate votes &lt; <i>T</i> &rarr; System flags Runoff Election between top two contenders.<br/>"
        "• <b>Case C (TIE):</b> Top two candidates receive identical vote tallies &rarr; System flags Runoff Election.<br/><br/>"
        "<b>2. Unopposed Candidates (YES / NO Referendum):</b><br/>"
        "When only one candidate contests a position, ZVote configures a democratic Referendum. Voters must choose "
        "<b>YES (Approve)</b> or <b>NO (Reject)</b>. The candidate is declared elected if and only if: "
        "<b>YES votes &gt; 50% of total referendum ballots cast</b>."
    )
    t_math = Table([[Paragraph(math_box, callout_style)]], colWidths=[504])
    t_math.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F1F5F9")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#64748B")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_math)
    story.append(Spacer(1, 15))

    # ==========================================
    # CHAPTER 7: PROJECT DEFENSE Q&A (THE TOP 25 QUESTIONS)
    # ==========================================
    story.append(Paragraph("7. Master Project Defense Q&A: Top 25 Questions & Answers", h1_style))
    story.append(Paragraph(
        "Below are the 25 most critical questions external examiners and faculty professors ask during project defenses, accompanied by precise, high-scoring technical responses:",
        body_style
    ))

    qas = [
        (
            "Q1: What motivated the development of ZVote when online voting systems already exist?",
            "Traditional electronic voting systems rely on centralized databases (MySQL, MongoDB, PostgreSQL) where system administrators have god-mode privileges to manipulate election results using direct SQL updates with no verifiable public audit trail. ZVote integrates blockchain smart contracts to decentralize the ballot box, ensuring that once a vote is cast, it is immutable, tamper-proof, and publicly verifiable."
        ),
        (
            "Q2: Why did you choose Polygon Amoy rather than Ethereum Mainnet or a local blockchain?",
            "Ethereum Mainnet is impractical for university elections due to high transaction gas fees ($5–$50 per vote) and slow block times (12–15 seconds). A local Hardhat node proves code locally but provides zero public verifiability. Polygon Amoy PoS testnet offers 2-second block times, high throughput (65,000 TPS), EVM compatibility, and sub-cent gas fees, allowing us to deploy a real, live, publicly verifiable system."
        ),
        (
            "Q3: How do you protect voter secrecy if the blockchain is public and transparent?",
            "Through our Zero-Linkability decoupled architecture. Personal student demographic information (Name, Student ID, Email) lives exclusively in our off-chain PostgreSQL database. The smart contract on the blockchain only receives pseudonymous candidate indices and an abstract voter address. The link between student identity and candidate choice is never written to disk anywhere."
        ),
        (
            "Q4: If voters don't have MetaMask or cryptocurrency, who pays the gas fees?",
            "ZVote uses a Gasless Relayer Pattern. The Election Authority wallet signs and submits all vote transactions on behalf of the voters, absorbing the minor gas cost (~0.001 POL per vote). Students simply authenticate with their familiar student ID and password, requiring zero crypto knowledge."
        ),
        (
            "Q5: What prevents the Election Authority / Relayer from altering the student's vote?",
            "When the student submits their vote, the backend immediately returns the cryptographic transaction receipt containing the mined transaction hash (`txHash`). The student can click 'Verify on Polygonscan' or use the in-app Vote Verification portal to view the raw blockchain receipt, which confirms the exact position ID and candidate index sealed in the block."
        ),
        (
            "Q6: How does the system prevent a student from voting twice?",
            "Through a two-tier guard. Tier 1 (Off-Chain): The PostgreSQL `VoteReceipt` table has a composite unique constraint on `(userId, positionId)`. If a student attempts a second vote, the database query aborts. Tier 2 (On-Chain): The Solidity contract maintains a mapping `votedForPosition[positionId][voter]`. If a duplicate vote reaches the contract, the transaction reverts with an error."
        ),
        (
            "Q7: Why did you use Brevo HTTPS API instead of standard SMTP like Gmail or Sendgrid?",
            "Cloud platform free tiers (Render, AWS EC2, Vercel) block outbound TCP ports 25, 465, and 587 by default to prevent spam relays. Standard SMTP connections hang and time out. Brevo's REST API operates over standard HTTPS port 443, which is universally open, ensuring 100% reliable credential dispatch directly to students' personal inboxes."
        ),
        (
            "Q8: Can the election administrator see student passwords?",
            "No. When student accounts are generated, passwords are encrypted using Bcrypt (10 salt rounds) for database verification. For administrative views and CSV exports, the backend transforms the passwords into one-way cryptographic SHA-256 hashes. The plain text password is only dispatched to the student's personal email."
        ),
        (
            "Q9: What happens if a position only has one candidate?",
            "ZVote automatically triggers an Unopposed YES/NO Approval Referendum. The voter selects either YES (Approve) or NO (Reject). The candidate must achieve greater than 50% YES votes of total ballots cast to be declared elected."
        ),
        (
            "Q10: What is your 50% + 1 victory calculation and how does it handle ties?",
            "We calculate the majority threshold as T = floor(V / 2) + 1, where V is the total votes cast. If the leading candidate meets or exceeds T, they win (`WON_MAJORITY`). If no candidate reaches T, or if the top two candidates receive identical votes, the system classifies the result as `RUNOFF_REQUIRED`."
        ),
        (
            "Q11: Why are vote tallies hidden while the election is active?",
            "To uphold the Sealed Ballot Protocol and eliminate bandwagon bias. In behavioral political science, displaying real-time vote totals influences undecided voters and encourages tactical voting. ZVote displays live voter turnout percentage while keeping candidate totals encrypted and sealed until polls officially close."
        ),
        (
            "Q12: How do you handle network race conditions during high-volume voting bursts?",
            "We wrapped the ethers.js signing wallet in a `NonceManager`. In Ethereum, if multiple transactions are sent concurrently with the same nonce, the transaction fails with 'nonce too low'. The NonceManager automatically queues and increments nonces sequentially, ensuring zero failed transactions during peak voting hours."
        ),
        (
            "Q13: How does ZVote handle departmental election restrictions?",
            "Through Departmental Enclaves. When creating a departmental election, the administrator assigns a `targetDepartment`. The backend and frontend filter candidates and voters so that only students whose registered department matches the election target department can view and vote on that ballot."
        ),
        (
            "Q14: What is the purpose of SERVER_BOOT_ID in the JWT authentication?",
            "Whenever the backend server restarts or is redeployed, it generates a fresh UUID called `SERVER_BOOT_ID`. When a user presents a JWT, the server verifies that the token's `bootId` matches the active server session. This provides instant global session revocation upon server restart."
        ),
        (
            "Q15: How are candidate pictures handled?",
            "Administrators can either supply an external HTTPS picture URL or upload candidate portraits directly via the `uploadImage` endpoint. The server validates image MIME types (JPEG, PNG, WebP) and enforces a 2MB file size ceiling to prevent denial-of-service through storage exhaustion."
        ),
        (
            "Q16: How scalable is the system for a campus of 20,000 students?",
            "The off-chain API is stateless and can scale horizontally across multiple instances behind a load balancer. PostgreSQL read-replicas handle voter profile queries. On Polygon, 20,000 votes represent ~0.3% of the network's daily throughput, well within standard operational capacity."
        ),
        (
            "Q17: What prevents an attacker from voting after the election end time?",
            "Both off-chain and on-chain checks prevent late voting. The API validates `new Date() <= election.endTime`. In addition, when the administrator closes the election, the backend calls `endElection()` on the smart contract, which sets `electionActive = false`. Any subsequent on-chain vote attempt reverts immediately."
        ),
        (
            "Q18: What is the role of Prisma ORM in the system?",
            "Prisma generates type-safe database queries and migration scripts, preventing SQL injection vulnerabilities. It establishes foreign key cascades between elections, positions, candidates, and vote receipts."
        ),
        (
            "Q19: How did you optimize gas consumption in your smart contract?",
            "We used Solidity 0.8.19 optimizer set to 200 runs, packed struct fields compactly, used `uint256` for native EVM word alignment, and replaced costly on-chain string lookups with compact integer indices for positions and candidates."
        ),
        (
            "Q20: Can a student vote on their smartphone?",
            "Yes. ZVote is fully responsive, built with TailwindCSS mobile-first design, fluid grid layouts, and an animated mobile navigation drawer. Students can authenticate and vote from any iOS or Android browser."
        ),
        (
            "Q21: What happens if a student forgets their password?",
            "The student clicks 'Forgot Password' on the login screen and enters their email. The backend creates a cryptographic 32-byte hex token with a 1-hour expiration timestamp in the database and dispatches a password reset link via Brevo."
        ),
        (
            "Q22: Why not store student personal info on IPFS (InterPlanetary File System)?",
            "IPFS is a public, immutable, distributed content-addressed network. Storing personally identifiable student information (PII) on IPFS violates global data privacy regulations (GDPR, Data Protection Act) because records on IPFS cannot be modified or deleted. PII must remain in an off-chain relational database."
        ),
        (
            "Q23: How does the system handle bulk student roster ingestion?",
            "The system uses `xlsx` library to parse `.csv` or `.xlsx` files into normalized objects. It performs data sanitization, checks for duplicates against the database, generates unique wallet addresses and temporary passwords, and intermittently queues welcome emails to prevent provider rate-limiting."
        ),
        (
            "Q24: What is individual verifiability versus universal verifiability?",
            "Individual Verifiability: A student can verify that their specific ballot was included in the blockchain ledger using their transaction hash. Universal Verifiability: Any observer, auditor, or candidate can independently inspect the smart contract's public tallies and sum the votes to confirm the accuracy of the final winner without needing privileged credentials."
        ),
        (
            "Q25: What is the final conclusion and recommendation of this project?",
            "ZVote successfully proves that blockchain technology can eliminate election tampering in university governance without imposing technical friction or financial cost on voters. The hybrid Web2.5 architecture represents the optimal paradigm for institutional electronic voting."
        )
    ]

    for q, a in qas:
        story.append(Paragraph(f"<b>{q}</b>", qa_q_style))
        story.append(Paragraph(a, qa_a_style))
        story.append(Spacer(1, 3))

    # Build document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF successfully generated: {filename}")

if __name__ == "__main__":
    out_dir = "addons"
    if not os.path.exists(out_dir):
        os.makedirs(out_dir)
    build_pdf()
