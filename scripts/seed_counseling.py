#!/usr/bin/env python3
"""Seed the database with counseling roadmap content for 7 STEM areas.

Usage:
    python scripts/seed_counseling.py
"""

import json
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.database.engine import init_db, get_db
from src.database.models import CounselingContent

# ──────────────────────────────────────────────────────────────────────
# 1. Computer Science
# ──────────────────────────────────────────────────────────────────────

CS_DATA = {
    "stem_area": "cs",
    "display_name": "Computer Science",
    "icon": "Code",
    "description": "From USACO Bronze to MIT EECS — a four-year roadmap for aspiring computer scientists targeting top programs.",
    "content": {
        "grade_data": {
            "9th": {
                "label": "9th Grade",
                "subtitle": "Build the Foundation",
                "color": "emerald",
                "academics": [
                    {
                        "title": "AP Computer Science A",
                        "description": "Your first AP. Aim for a 5. This is the baseline signal that you're serious about CS.",
                        "icon": "Code",
                        "tags": ["AP Exam", "Java"],
                    },
                    {
                        "title": "Honors/AP Math Track",
                        "description": "Take the most advanced math available (Honors Algebra II or AP Precalculus). Math rigor matters for MIT/Caltech.",
                        "icon": "BookOpen",
                        "tags": ["Math", "Core"],
                    },
                    {
                        "title": "Strong GPA Foundation",
                        "description": "Target unweighted 3.9+. Take honors in English, Science, and History where available.",
                        "icon": "Star",
                        "tags": ["GPA", "All Subjects"],
                    },
                ],
                "competitions": [
                    {
                        "title": "USACO Bronze & Silver",
                        "description": "Start competitive programming NOW. Work through usaco.guide systematically. Goal: reach Silver by end of 9th grade, ideally Gold.",
                        "icon": "Trophy",
                        "tags": ["USACO", "Critical"],
                    },
                    {
                        "title": "AMC 10",
                        "description": "Take the AMC 10 in November/February. Strong math scores complement your CS profile. Aim for AIME qualification.",
                        "icon": "Target",
                        "tags": ["Math Competition"],
                    },
                    {
                        "title": "Hackathons",
                        "description": "Participate in 2-3 local or online hackathons. Focus on learning and building, not winning yet.",
                        "icon": "Code",
                        "tags": ["Team Building"],
                    },
                ],
                "projects": [
                    {
                        "title": "Personal Website / Portfolio",
                        "description": "Build a personal site from scratch (not a template). Learn HTML/CSS/JS, then React. This becomes your portfolio hub.",
                        "icon": "FileText",
                        "tags": ["Web Dev", "Portfolio"],
                    },
                    {
                        "title": "First Meaningful Project",
                        "description": "Build something that solves a real problem. A tool for your school, a community app, or a data visualization. Quality over quantity.",
                        "icon": "Lightbulb",
                        "tags": ["Impact", "Real-World"],
                    },
                ],
                "summer": [
                    {
                        "title": "USACO Intensive Training",
                        "description": "Dedicate significant summer time to competitive programming. Target: Gold division by fall of 10th grade.",
                        "icon": "Trophy",
                        "tags": ["USACO", "Priority"],
                    },
                    {
                        "title": "Learn a Framework / Language",
                        "description": "Pick up Python deeply, or learn a framework like React/Flask. Build 2-3 small projects to solidify skills.",
                        "icon": "Code",
                        "tags": ["Skill Building"],
                    },
                    {
                        "title": "Start Cold-Emailing Professors",
                        "description": "Begin reaching out to CS professors at local universities for research mentorship. Send 20 emails, expect 1-2 responses.",
                        "icon": "FlaskConical",
                        "tags": ["Research", "Networking"],
                    },
                ],
            },
            "10th": {
                "label": "10th Grade",
                "subtitle": "Sharpen the Spike",
                "color": "blue",
                "academics": [
                    {
                        "title": "AP Calculus BC",
                        "description": "Essential for top CS schools. Take BC directly if possible. Score of 5 expected.",
                        "icon": "BookOpen",
                        "tags": ["AP Exam", "Math"],
                    },
                    {
                        "title": "AP Physics C: Mechanics",
                        "description": "Shows quantitative depth. Pairs well with CS for MIT/Caltech applications.",
                        "icon": "FlaskConical",
                        "tags": ["AP Exam", "Science"],
                    },
                    {
                        "title": "AP CS Principles or AP Statistics",
                        "description": "Easy 5. Frees up bandwidth for competitions and projects. Take whichever fits your schedule.",
                        "icon": "Code",
                        "tags": ["AP Exam"],
                    },
                ],
                "competitions": [
                    {
                        "title": "USACO Gold & Platinum",
                        "description": "This is THE year to push hard. USACO Platinum is the single strongest CS signal on your application. Train daily.",
                        "icon": "Trophy",
                        "tags": ["USACO", "Critical"],
                    },
                    {
                        "title": "AIME Qualification",
                        "description": "If you scored well on AMC 10 last year, push for AIME this year. Even qualifying is a strong signal.",
                        "icon": "Target",
                        "tags": ["Math Competition"],
                    },
                    {
                        "title": "Science Fair (Regional/State)",
                        "description": "Start a CS-related science fair project. This is your pipeline to ISEF. Choose a topic at the intersection of CS and another field.",
                        "icon": "FlaskConical",
                        "tags": ["ISEF Pipeline", "Research"],
                    },
                ],
                "projects": [
                    {
                        "title": "Flagship Open Source Project",
                        "description": "Build something substantial on GitHub. Aim for 100+ stars. Could be a developer tool, ML project, or novel application.",
                        "icon": "Code",
                        "tags": ["GitHub", "Impact"],
                    },
                    {
                        "title": "Research with a Professor",
                        "description": "Formalize your research relationship. Work toward a publishable result. Even a workshop paper or poster matters.",
                        "icon": "FlaskConical",
                        "tags": ["Research", "Publication"],
                    },
                ],
                "summer": [
                    {
                        "title": "Apply to RSI (Research Science Institute)",
                        "description": "Apply in November. ~4% acceptance rate, but the application process itself is valuable. Run by MIT/CEE.",
                        "icon": "Star",
                        "tags": ["Elite Program", "MIT"],
                    },
                    {
                        "title": "Research Internship at University",
                        "description": "Spend the summer in a professor's lab. Aim for a concrete deliverable: paper draft, poster, or working system.",
                        "icon": "FlaskConical",
                        "tags": ["Research", "Priority"],
                    },
                    {
                        "title": "Science Fair Project Development",
                        "description": "Use summer to advance your ISEF-track project. Regional fairs happen in fall/winter of 11th grade.",
                        "icon": "Trophy",
                        "tags": ["ISEF", "Long-term"],
                    },
                ],
            },
            "11th": {
                "label": "11th Grade",
                "subtitle": "Peak Performance Year",
                "color": "violet",
                "academics": [
                    {
                        "title": "AP Physics C: E&M + College Math",
                        "description": "Take Multivariable Calculus or Linear Algebra via dual enrollment. Shows you've outgrown the AP curriculum.",
                        "icon": "BookOpen",
                        "tags": ["Beyond AP", "Math"],
                    },
                    {
                        "title": "AP English Language + AP US History",
                        "description": "Humanities APs show intellectual breadth. Important for Stanford especially.",
                        "icon": "FileText",
                        "tags": ["AP Exam", "Breadth"],
                    },
                    {
                        "title": "SAT/ACT + SAT Subject Tests",
                        "description": "Take in spring. Target: 1550+ SAT or 35+ ACT. These are table stakes, not differentiators.",
                        "icon": "Target",
                        "tags": ["Standardized Tests"],
                    },
                ],
                "competitions": [
                    {
                        "title": "USACO Platinum (if not already)",
                        "description": "Last chance for December/January contests. Platinum on your application is transformative.",
                        "icon": "Trophy",
                        "tags": ["USACO", "Critical"],
                    },
                    {
                        "title": "ISEF Qualification",
                        "description": "Present at regional science fair. Win your category to advance to state, then ISEF. A top-3 ISEF finish is Ivy-level.",
                        "icon": "Trophy",
                        "tags": ["ISEF", "Elite"],
                    },
                    {
                        "title": "Other CS Competitions",
                        "description": "Google Code Jam, Facebook Hacker Cup, Codeforces Div 1 — any of these add credibility to your competitive programming profile.",
                        "icon": "Code",
                        "tags": ["Competitive Programming"],
                    },
                ],
                "projects": [
                    {
                        "title": "Research Publication",
                        "description": "Submit to a workshop or conference. Even arXiv preprints count. The goal is demonstrating research capability.",
                        "icon": "FlaskConical",
                        "tags": ["Publication", "Critical"],
                    },
                    {
                        "title": "Leadership in CS Community",
                        "description": "Teach CS at your school, organize a hackathon, lead a competitive programming club. Show you lift others up.",
                        "icon": "GraduationCap",
                        "tags": ["Leadership", "Community"],
                    },
                ],
                "summer": [
                    {
                        "title": "RSI or Equivalent Elite Program",
                        "description": "If accepted to RSI, this is your summer. If not, pursue a serious research internship at a top university.",
                        "icon": "Star",
                        "tags": ["Elite Program"],
                    },
                    {
                        "title": "College Application Prep",
                        "description": "Start drafting essays. Begin the Common App. Research specific programs (CMU SCS, MIT EECS, Stanford CS).",
                        "icon": "FileText",
                        "tags": ["Applications"],
                    },
                    {
                        "title": "Teacher Recommendation Letters",
                        "description": "Ask teachers in May/June. Choose teachers who know you well AND can speak to your intellectual curiosity.",
                        "icon": "GraduationCap",
                        "tags": ["Letters of Rec"],
                    },
                ],
            },
            "12th": {
                "label": "12th Grade",
                "subtitle": "Execute & Ship Applications",
                "color": "amber",
                "academics": [
                    {
                        "title": "Maintain Your GPA",
                        "description": "Senioritis is real but mid-year reports matter. Continue with rigorous courses. Don't drop the ball.",
                        "icon": "BookOpen",
                        "tags": ["GPA", "Consistency"],
                    },
                    {
                        "title": "Additional APs (if applicable)",
                        "description": "AP Chemistry, AP Biology, or more college math. Show continued growth. 8-12 APs total is typical for top admits.",
                        "icon": "Star",
                        "tags": ["AP Exams"],
                    },
                ],
                "competitions": [
                    {
                        "title": "Final USACO Contests",
                        "description": "December and January contests. If you're already Platinum, a strong performance is icing on the cake.",
                        "icon": "Trophy",
                        "tags": ["USACO", "Final Shot"],
                    },
                    {
                        "title": "ISEF Finals (if qualified)",
                        "description": "Happens in May. Even if apps are submitted, awards still matter for waitlist decisions and scholarship applications.",
                        "icon": "Trophy",
                        "tags": ["ISEF"],
                    },
                ],
                "projects": [
                    {
                        "title": "Polish Your Portfolio",
                        "description": "Update GitHub, personal website, and any public-facing work. Admissions officers do look at links you provide.",
                        "icon": "FileText",
                        "tags": ["Portfolio"],
                    },
                ],
                "summer": [
                    {
                        "title": "Early Decision / Early Action (Nov 1)",
                        "description": "Apply EA to MIT and Caltech (both non-binding). Apply ED to CMU SCS if it's your top choice. Stanford REA if Stanford is #1.",
                        "icon": "Target",
                        "tags": ["Applications", "Critical"],
                    },
                    {
                        "title": "Regular Decision (Jan 1-5)",
                        "description": "Apply broadly to reach and match schools. Include UC Berkeley EECS, Georgia Tech, UIUC CS, and others.",
                        "icon": "FileText",
                        "tags": ["Applications"],
                    },
                    {
                        "title": "Essays That Tell YOUR Story",
                        "description": "Your essays should connect the dots: why CS, what you've built, what you want to build next. Be specific and authentic.",
                        "icon": "Lightbulb",
                        "tags": ["Essays", "Critical"],
                    },
                ],
            },
        },
        "key_insights": [
            {
                "icon": "Trophy",
                "icon_color": "text-amber-500",
                "title": "USACO is the #1 CS Signal",
                "description": "MIT, CMU, and Caltech admissions officers know exactly what USACO Platinum means. Start grinding in 9th grade. Progression Bronze to Platinum takes most serious students 2-3 years.",
                "resources": ["usaco.guide", "CSES Problem Set", "Codeforces"],
            },
            {
                "icon": "FlaskConical",
                "icon_color": "text-violet-500",
                "title": "Research > Internships",
                "description": "A summer at a professor's lab producing a paper (even unpublished) beats a summer as a tech company intern. Cold-emailing professors works. Send 20 emails, expect 1-2 responses.",
                "resources": [],
            },
            {
                "icon": "Target",
                "icon_color": "text-blue-500",
                "title": "The \"Spike\" Philosophy",
                "description": "Admissions officers at top schools look for a \"spike\" — one thing you do at a genuinely elite level — rather than a well-rounded student who did 12 decent extracurriculars. Build the spike, let everything else support it.",
                "resources": [],
            },
            {
                "icon": "Star",
                "icon_color": "text-emerald-500",
                "title": "RSI is Worth the Effort",
                "description": "The Research Science Institute (run at MIT each summer) is perhaps the single most powerful summer program for STEM admits. Apply in November of 10th or 11th grade. ~4% acceptance rate, but the application itself is valuable.",
                "resources": [],
            },
            {
                "icon": "GraduationCap",
                "icon_color": "text-rose-500",
                "title": "CMU: Apply Direct to SCS",
                "description": "Apply to the School of Computer Science directly, not \"undecided.\" They want to see you've thought carefully about which program (CS, AI, HCI, etc.) and why. Research specific professors.",
                "resources": [],
            },
        ],
        "ap_course_timeline": [
            {"grade": "9th", "courses": ["AP Computer Science A"]},
            {"grade": "10th", "courses": ["AP Calculus BC", "AP Physics C: Mechanics", "AP CS Principles or AP Statistics"]},
            {"grade": "11th", "courses": ["AP Physics C: E&M", "AP English Language", "AP US History", "Multivariable Calculus / Linear Algebra (dual enrollment)"]},
            {"grade": "12th", "courses": ["AP Chemistry or AP Biology", "Additional APs as available"]},
        ],
        "competition_milestones": [
            {
                "title": "USACO Progression",
                "steps": ["Bronze (9th)", "Silver (9th)", "Gold (10th)", "Platinum (11th)"],
                "color": "amber",
            },
            {
                "title": "Math Competitions",
                "steps": ["AMC 10 (9th)", "AIME Qualifier (10th)", "AIME 7+ (11th)", "USAMO Qualifier (11th-12th)"],
                "color": "blue",
            },
            {
                "title": "Science Fair → ISEF",
                "steps": ["School Fair (9th)", "Regional Fair (10th)", "State Fair (11th)", "ISEF Finals (11th-12th)"],
                "color": "emerald",
            },
            {
                "title": "Research Pipeline",
                "steps": ["Cold-email Professors (9th)", "Lab Assistant (10th)", "Independent Project (11th)", "Publication (11th-12th)"],
                "color": "violet",
            },
        ],
        "target_schools": [
            {"school": "MIT", "program": "EECS (6-3)", "strategy": "EA non-binding. Loves builders and USACO Platinum. Show genuine fit with MIT culture.", "deadline": "Nov 1 EA"},
            {"school": "Stanford", "program": "Computer Science", "strategy": "REA (binding-ish). Looks for intellectual vitality and impact. Essays matter enormously.", "deadline": "Nov 1 REA"},
            {"school": "CMU", "program": "School of Computer Science", "strategy": "Apply directly to SCS. ED available if CMU is your top choice. Research specific sub-programs.", "deadline": "Nov 1 ED / Jan 5 RD"},
            {"school": "Caltech", "program": "Computer Science", "strategy": "EA non-binding. Smallest class — very research-focused. Math strength is essential.", "deadline": "Nov 1 EA"},
        ],
        "footer_note": "This plan is ambitious — that's intentional. You don't need to do everything. The goal is to build a compelling \"spike\" in CS through some combination of competitive programming, research, and meaningful projects. Pick the path that excites you most and go deep.",
    },
}

# ──────────────────────────────────────────────────────────────────────
# 2. Electrical Engineering
# ──────────────────────────────────────────────────────────────────────

EE_DATA = {
    "stem_area": "electrical_engineering",
    "display_name": "Electrical Engineering",
    "icon": "Zap",
    "description": "From circuit labs to semiconductor research — a four-year roadmap for aspiring electrical engineers targeting top programs.",
    "content": {
        "grade_data": {
            "9th": {
                "label": "9th Grade",
                "subtitle": "Discover Circuits & Signals",
                "color": "emerald",
                "academics": [
                    {
                        "title": "Honors Physics + Advanced Math",
                        "description": "Take the most rigorous physics and math available. EE is built on a strong physics and math foundation.",
                        "icon": "BookOpen",
                        "tags": ["Physics", "Core"],
                    },
                    {
                        "title": "AP Computer Science A",
                        "description": "Programming is essential for modern EE. Embedded systems, signal processing, and VLSI all require coding fluency.",
                        "icon": "Code",
                        "tags": ["AP Exam", "Programming"],
                    },
                    {
                        "title": "Strong GPA Foundation",
                        "description": "Target unweighted 3.9+. Take honors in all available subjects. A broad academic foundation matters.",
                        "icon": "Star",
                        "tags": ["GPA", "All Subjects"],
                    },
                ],
                "competitions": [
                    {
                        "title": "Science Olympiad — Circuit Lab",
                        "description": "Join your school's Science Olympiad team and focus on Circuit Lab event. Learn Ohm's law, Kirchhoff's laws, and basic AC/DC circuit analysis.",
                        "icon": "Zap",
                        "tags": ["Science Olympiad", "Circuits"],
                    },
                    {
                        "title": "FIRST Robotics (FRC/FTC)",
                        "description": "Join a FIRST team. Focus on the electrical subsystem: wiring, motor controllers, sensors, and basic embedded programming.",
                        "icon": "Wrench",
                        "tags": ["Robotics", "Hands-On"],
                    },
                    {
                        "title": "AMC 10",
                        "description": "Strong math competition results complement an EE profile. EE is one of the most math-intensive engineering disciplines.",
                        "icon": "Target",
                        "tags": ["Math Competition"],
                    },
                ],
                "projects": [
                    {
                        "title": "Arduino Starter Projects",
                        "description": "Build 5-10 Arduino projects: LED matrices, sensor dashboards, motor control. Learn to read datasheets and wire circuits from schematics.",
                        "icon": "Zap",
                        "tags": ["Arduino", "Hands-On"],
                    },
                    {
                        "title": "Basic Electronics Lab Setup",
                        "description": "Get a breadboard, multimeter, basic components, and an oscilloscope (even a cheap one). Start building circuits from scratch.",
                        "icon": "Wrench",
                        "tags": ["Lab Skills", "Foundation"],
                    },
                ],
                "summer": [
                    {
                        "title": "Electronics Deep Dive",
                        "description": "Work through a structured electronics curriculum. 'The Art of Electronics' student edition or MIT OpenCourseWare 6.002 are excellent starting points.",
                        "icon": "BookOpen",
                        "tags": ["Self-Study", "Priority"],
                    },
                    {
                        "title": "Raspberry Pi / IoT Project",
                        "description": "Build a connected device: weather station, home automation system, or sensor network. Learn Linux, GPIO, and network protocols.",
                        "icon": "Code",
                        "tags": ["IoT", "Project"],
                    },
                    {
                        "title": "Reach Out to EE Professors",
                        "description": "Start emailing local university EE professors. Express interest in lab tours or volunteer work. Persistence is key.",
                        "icon": "GraduationCap",
                        "tags": ["Research", "Networking"],
                    },
                ],
            },
            "10th": {
                "label": "10th Grade",
                "subtitle": "Go Deeper into Hardware",
                "color": "blue",
                "academics": [
                    {
                        "title": "AP Physics C: Mechanics",
                        "description": "The first calculus-based physics course. Essential for any engineering discipline. Aim for a 5.",
                        "icon": "FlaskConical",
                        "tags": ["AP Exam", "Physics"],
                    },
                    {
                        "title": "AP Calculus BC",
                        "description": "EE is extremely math-heavy. Calculus BC is non-negotiable. Mastering integration and series is fundamental to circuit analysis and signal processing.",
                        "icon": "BookOpen",
                        "tags": ["AP Exam", "Math"],
                    },
                    {
                        "title": "AP Chemistry",
                        "description": "Semiconductor physics, battery technology, and materials science all connect to chemistry. Also broadens your AP portfolio.",
                        "icon": "FlaskConical",
                        "tags": ["AP Exam", "Science"],
                    },
                ],
                "competitions": [
                    {
                        "title": "Science Olympiad — Detector Building",
                        "description": "Build electronic detectors from scratch. This event tests circuit design, sensor calibration, and measurement precision under pressure.",
                        "icon": "Zap",
                        "tags": ["Science Olympiad", "Building"],
                    },
                    {
                        "title": "FIRST Robotics — Electrical Lead",
                        "description": "Take on a leadership role in your team's electrical subsystem. Design wiring harnesses, debug sensor issues, program motor controllers.",
                        "icon": "Wrench",
                        "tags": ["Robotics", "Leadership"],
                    },
                    {
                        "title": "Science Fair — EE Project",
                        "description": "Start an ISEF-track science fair project in an EE area: wireless power transfer, antenna design, signal processing, or renewable energy.",
                        "icon": "FlaskConical",
                        "tags": ["ISEF Pipeline", "Research"],
                    },
                ],
                "projects": [
                    {
                        "title": "PCB Design Project",
                        "description": "Learn KiCad or Eagle. Design and order your first custom PCB. Even a simple project (LED driver, amplifier) teaches invaluable skills.",
                        "icon": "Zap",
                        "tags": ["PCB Design", "Critical"],
                    },
                    {
                        "title": "Embedded Systems Project",
                        "description": "Move beyond Arduino to STM32 or ESP32. Build something with real-time constraints: a motor controller, a digital synthesizer, or a wireless sensor network.",
                        "icon": "Code",
                        "tags": ["Embedded", "Advanced"],
                    },
                ],
                "summer": [
                    {
                        "title": "University Research Internship",
                        "description": "Spend the summer in an EE lab. VLSI, RF, power electronics, or signal processing — get hands-on experience with real research equipment.",
                        "icon": "FlaskConical",
                        "tags": ["Research", "Priority"],
                    },
                    {
                        "title": "Apply to RSI / MOSTEC / SSP",
                        "description": "RSI (MIT), MOSTEC (MIT), SSP (astrophysics but shows STEM rigor). These elite programs are game-changers for admissions.",
                        "icon": "Star",
                        "tags": ["Elite Program"],
                    },
                    {
                        "title": "Learn Signal Processing Basics",
                        "description": "Fourier transforms, filters, sampling theory. Use Python + NumPy/SciPy to implement DSP algorithms. This is the mathematical heart of EE.",
                        "icon": "BookOpen",
                        "tags": ["DSP", "Self-Study"],
                    },
                ],
            },
            "11th": {
                "label": "11th Grade",
                "subtitle": "Peak Performance Year",
                "color": "violet",
                "academics": [
                    {
                        "title": "AP Physics C: E&M",
                        "description": "THE defining AP for aspiring EEs. Electromagnetic theory is the bedrock of EE. Aim for a 5 — this score carries weight.",
                        "icon": "Zap",
                        "tags": ["AP Exam", "Critical"],
                    },
                    {
                        "title": "Multivariable Calculus + Linear Algebra",
                        "description": "Via dual enrollment or online. Both are essential for electromagnetics, control systems, and signal processing.",
                        "icon": "BookOpen",
                        "tags": ["Beyond AP", "Math"],
                    },
                    {
                        "title": "AP English Language + AP US History",
                        "description": "Humanities APs round out your profile. MIT and Stanford value broad intellectual curiosity.",
                        "icon": "FileText",
                        "tags": ["AP Exam", "Breadth"],
                    },
                ],
                "competitions": [
                    {
                        "title": "ISEF Qualification",
                        "description": "Push your EE research project through regional and state science fairs. An ISEF finalist in an EE category is an extraordinary achievement.",
                        "icon": "Trophy",
                        "tags": ["ISEF", "Elite"],
                    },
                    {
                        "title": "Science Olympiad — National Qualifier",
                        "description": "Lead your team to state and national competitions. Excel in Circuit Lab and any electronics-related events.",
                        "icon": "Zap",
                        "tags": ["Science Olympiad", "National"],
                    },
                    {
                        "title": "Physics Competitions",
                        "description": "F=ma exam and USAPhO. Strong physics competition results align perfectly with an EE profile.",
                        "icon": "Target",
                        "tags": ["Physics Olympiad"],
                    },
                ],
                "projects": [
                    {
                        "title": "Research Publication",
                        "description": "Work toward publishing or presenting your research. Conference poster, workshop paper, or journal submission. Demonstrating research output is critical.",
                        "icon": "FlaskConical",
                        "tags": ["Publication", "Critical"],
                    },
                    {
                        "title": "Advanced Hardware Project",
                        "description": "Build something impressive: an FPGA-based design, a software-defined radio, a motor drive, or an IoT platform with custom PCBs.",
                        "icon": "Zap",
                        "tags": ["Portfolio", "Advanced"],
                    },
                ],
                "summer": [
                    {
                        "title": "RSI or Research Internship",
                        "description": "If accepted to RSI, go. Otherwise, pursue a focused research project at a university lab. Aim for a publishable result.",
                        "icon": "Star",
                        "tags": ["Elite Program"],
                    },
                    {
                        "title": "College Application Prep",
                        "description": "Start drafting essays. Research MIT EECS, Stanford EE, Caltech EE, Georgia Tech ECE. Visit campuses if possible.",
                        "icon": "FileText",
                        "tags": ["Applications"],
                    },
                    {
                        "title": "Teacher Recommendation Letters",
                        "description": "Ask your physics and math teachers. They should be able to speak to your quantitative ability and passion for hardware.",
                        "icon": "GraduationCap",
                        "tags": ["Letters of Rec"],
                    },
                ],
            },
            "12th": {
                "label": "12th Grade",
                "subtitle": "Execute & Ship Applications",
                "color": "amber",
                "academics": [
                    {
                        "title": "Maintain Your GPA",
                        "description": "Mid-year reports go to colleges. Continue with rigorous courses — differential equations if available.",
                        "icon": "BookOpen",
                        "tags": ["GPA", "Consistency"],
                    },
                    {
                        "title": "Additional APs / College Courses",
                        "description": "AP Statistics, AP Biology, or more advanced math/physics through dual enrollment. 8-12 APs total is the target.",
                        "icon": "Star",
                        "tags": ["AP Exams"],
                    },
                ],
                "competitions": [
                    {
                        "title": "Final Robotics Season",
                        "description": "Lead your FRC/FTC team through one more season. Mentoring younger members shows maturity and leadership.",
                        "icon": "Wrench",
                        "tags": ["Robotics", "Leadership"],
                    },
                    {
                        "title": "ISEF Finals (if qualified)",
                        "description": "Happens in May. Awards still matter for waitlist decisions and scholarships even after admission decisions.",
                        "icon": "Trophy",
                        "tags": ["ISEF"],
                    },
                ],
                "projects": [
                    {
                        "title": "Polish Your Portfolio",
                        "description": "Document your projects with schematics, photos, and write-ups. Create a portfolio website showcasing your hardware builds.",
                        "icon": "FileText",
                        "tags": ["Portfolio"],
                    },
                ],
                "summer": [
                    {
                        "title": "Early Decision / Early Action (Nov 1)",
                        "description": "Apply EA to MIT and Caltech (non-binding). Consider ED to Georgia Tech if it's your top choice. Stanford REA if Stanford is #1.",
                        "icon": "Target",
                        "tags": ["Applications", "Critical"],
                    },
                    {
                        "title": "Regular Decision (Jan 1-5)",
                        "description": "Apply to UC Berkeley EECS, Purdue ECE, UIUC ECE, Michigan EE, and other target/safety schools.",
                        "icon": "FileText",
                        "tags": ["Applications"],
                    },
                    {
                        "title": "Essays That Show Your Passion",
                        "description": "Talk about the moment you fell in love with hardware. Describe a debugging story. Connect your projects to what you want to build next.",
                        "icon": "Lightbulb",
                        "tags": ["Essays", "Critical"],
                    },
                ],
            },
        },
        "key_insights": [
            {
                "icon": "Zap",
                "icon_color": "text-amber-500",
                "title": "Physics C: E&M is Your Defining Course",
                "description": "For EE applicants, AP Physics C: E&M is the single most important AP. It's the closest high school course to actual EE content. A 5 here plus strong projects signals genuine readiness for EE coursework.",
                "resources": ["MIT OpenCourseWare 8.02", "Griffiths Electrodynamics"],
            },
            {
                "icon": "Wrench",
                "icon_color": "text-violet-500",
                "title": "Hands-On Building is Non-Negotiable",
                "description": "EE admissions committees want to see you've actually built things. PCB designs, embedded systems, robotics — the tangible evidence of hardware skills sets you apart from students who only have good grades.",
                "resources": ["KiCad", "Arduino", "Adafruit Learning"],
            },
            {
                "icon": "FlaskConical",
                "icon_color": "text-blue-500",
                "title": "Research in Emerging Areas Stands Out",
                "description": "Semiconductor physics, wireless communications, power electronics, and quantum computing hardware are hot research areas. A research project in any of these demonstrates forward-thinking ambition.",
                "resources": [],
            },
            {
                "icon": "Trophy",
                "icon_color": "text-emerald-500",
                "title": "FIRST Robotics Shows Team Skills",
                "description": "Unlike solo competitions, FIRST Robotics demonstrates your ability to work on engineering teams — exactly what EE looks like in practice. Take the electrical lead role and document your contributions.",
                "resources": ["FIRST Robotics", "Chief Delphi Forum"],
            },
            {
                "icon": "Code",
                "icon_color": "text-rose-500",
                "title": "Software Skills Multiply Your EE Impact",
                "description": "Modern EE is deeply intertwined with software. Embedded C, Python for signal processing, MATLAB, and HDLs (Verilog/VHDL) are all valuable. The best EEs are fluent in both hardware and software.",
                "resources": ["nand2tetris", "HDLBits (Verilog)"],
            },
        ],
        "ap_course_timeline": [
            {"grade": "9th", "courses": ["AP Computer Science A", "Honors Physics"]},
            {"grade": "10th", "courses": ["AP Physics C: Mechanics", "AP Calculus BC", "AP Chemistry"]},
            {"grade": "11th", "courses": ["AP Physics C: E&M", "AP English Language", "AP US History", "Multivariable Calculus (dual enrollment)"]},
            {"grade": "12th", "courses": ["AP Statistics or AP Biology", "Differential Equations (dual enrollment)"]},
        ],
        "competition_milestones": [
            {
                "title": "Science Olympiad Progression",
                "steps": ["Join Team, Circuit Lab (9th)", "Detector Building (10th)", "State Qualifier (11th)", "National Competitor (12th)"],
                "color": "amber",
            },
            {
                "title": "FIRST Robotics",
                "steps": ["Team Member (9th)", "Electrical Sub-Lead (10th)", "Electrical Lead (11th)", "Team Captain/Mentor (12th)"],
                "color": "blue",
            },
            {
                "title": "Science Fair → ISEF",
                "steps": ["Explore Topics (9th)", "Regional Fair (10th)", "State Fair (11th)", "ISEF Finals (11th-12th)"],
                "color": "emerald",
            },
            {
                "title": "Research Pipeline",
                "steps": ["Lab Tours (9th)", "Lab Assistant (10th)", "Independent Research (11th)", "Publication (11th-12th)"],
                "color": "violet",
            },
        ],
        "target_schools": [
            {"school": "MIT", "program": "EECS (6-2)", "strategy": "EA non-binding. MIT EECS is the gold standard. Show hardware builds and research depth.", "deadline": "Nov 1 EA"},
            {"school": "Stanford", "program": "Electrical Engineering", "strategy": "REA. Stanford EE emphasizes innovation and interdisciplinary thinking. Show impact beyond academics.", "deadline": "Nov 1 REA"},
            {"school": "Caltech", "program": "Electrical Engineering", "strategy": "EA non-binding. Tiny program — very research-intensive. Physics and math strength are paramount.", "deadline": "Nov 1 EA"},
            {"school": "Georgia Tech", "program": "ECE", "strategy": "EA available. Top-5 ECE program with strong industry connections. Great value and excellent research.", "deadline": "Nov 1 EA"},
        ],
        "footer_note": "This plan is ambitious — that's intentional. EE rewards students who combine theoretical depth (physics, math) with hands-on building skills. You don't need to do everything — pick the combination of projects, competitions, and research that excites you most and go deep.",
    },
}

# ──────────────────────────────────────────────────────────────────────
# 3. Mechanical Engineering
# ──────────────────────────────────────────────────────────────────────

ME_DATA = {
    "stem_area": "mechanical_engineering",
    "display_name": "Mechanical Engineering",
    "icon": "Wrench",
    "description": "From FIRST Robotics to MIT MechE — a four-year roadmap for aspiring mechanical engineers who love to design and build.",
    "content": {
        "grade_data": {
            "9th": {
                "label": "9th Grade",
                "subtitle": "Start Building Things",
                "color": "emerald",
                "academics": [
                    {
                        "title": "Honors Physics + Advanced Math",
                        "description": "Physics and math are the twin pillars of MechE. Take the most rigorous courses available. Mechanics intuition starts here.",
                        "icon": "BookOpen",
                        "tags": ["Physics", "Core"],
                    },
                    {
                        "title": "AP Computer Science A",
                        "description": "Computational skills are increasingly important in MechE. CAD, FEA, and simulations all benefit from programming ability.",
                        "icon": "Code",
                        "tags": ["AP Exam", "Programming"],
                    },
                    {
                        "title": "Strong GPA Foundation",
                        "description": "Target unweighted 3.9+. Take honors courses broadly. Top MechE programs value well-rounded academics.",
                        "icon": "Star",
                        "tags": ["GPA", "All Subjects"],
                    },
                ],
                "competitions": [
                    {
                        "title": "FIRST Robotics (FRC)",
                        "description": "This is THE most important extracurricular for MechE applicants. Join a team and focus on mechanical design: drivetrain, manipulators, and mechanisms.",
                        "icon": "Wrench",
                        "tags": ["Robotics", "Critical"],
                    },
                    {
                        "title": "Science Olympiad — Building Events",
                        "description": "Mousetrap Vehicle, Helicopter, Wright Stuff — these events teach engineering design, testing, and iteration under constraints.",
                        "icon": "Target",
                        "tags": ["Science Olympiad", "Design"],
                    },
                    {
                        "title": "AMC 10",
                        "description": "Math competition results matter for MechE too. Strong quantitative skills are the foundation of all engineering.",
                        "icon": "Target",
                        "tags": ["Math Competition"],
                    },
                ],
                "projects": [
                    {
                        "title": "Learn CAD (Fusion 360 / SolidWorks)",
                        "description": "Start learning 3D CAD software. Model real objects, then design original parts. This is a fundamental MechE skill.",
                        "icon": "Wrench",
                        "tags": ["CAD", "Foundation"],
                    },
                    {
                        "title": "First 3D Printing Project",
                        "description": "Design something in CAD and 3D print it. Iterate on the design. Learn about tolerances, material properties, and design for manufacturing.",
                        "icon": "Lightbulb",
                        "tags": ["3D Printing", "Hands-On"],
                    },
                ],
                "summer": [
                    {
                        "title": "CAD Mastery",
                        "description": "Dedicate time to becoming proficient in SolidWorks or Fusion 360. Complete online courses and build a portfolio of 10+ designs.",
                        "icon": "Wrench",
                        "tags": ["CAD", "Priority"],
                    },
                    {
                        "title": "Build a Mechanical Project",
                        "description": "Build something physical: a go-kart, a trebuchet, a CNC machine, or a custom 3D printer. Document the entire design process.",
                        "icon": "Lightbulb",
                        "tags": ["Hands-On", "Portfolio"],
                    },
                    {
                        "title": "Reach Out to Engineering Labs",
                        "description": "Email professors in mechanical engineering departments. Express interest in lab tours, volunteer work, or shadowing opportunities.",
                        "icon": "GraduationCap",
                        "tags": ["Research", "Networking"],
                    },
                ],
            },
            "10th": {
                "label": "10th Grade",
                "subtitle": "Deepen Design Skills",
                "color": "blue",
                "academics": [
                    {
                        "title": "AP Physics C: Mechanics",
                        "description": "THE most important AP for MechE. Newtonian mechanics is the core of your future major. Aim for a 5 — no exceptions.",
                        "icon": "FlaskConical",
                        "tags": ["AP Exam", "Critical"],
                    },
                    {
                        "title": "AP Calculus BC",
                        "description": "Essential for any engineering program. Differential equations, series, and integration are tools you'll use daily in MechE.",
                        "icon": "BookOpen",
                        "tags": ["AP Exam", "Math"],
                    },
                    {
                        "title": "AP Chemistry",
                        "description": "Materials science connects directly to chemistry. Understanding bonding, thermodynamics, and properties of materials is valuable.",
                        "icon": "FlaskConical",
                        "tags": ["AP Exam", "Science"],
                    },
                ],
                "competitions": [
                    {
                        "title": "FIRST Robotics — Mechanical Lead",
                        "description": "Step into a leadership role. Design mechanisms, manage the CAD assembly, mentor newer members. Document your design decisions.",
                        "icon": "Wrench",
                        "tags": ["Robotics", "Leadership"],
                    },
                    {
                        "title": "TSA (Technology Student Association)",
                        "description": "Compete in engineering design events: Structural Design, Flight, Dragster. These challenge you to optimize designs within constraints.",
                        "icon": "Target",
                        "tags": ["TSA", "Engineering"],
                    },
                    {
                        "title": "Science Fair — Engineering Project",
                        "description": "Start an ISEF-track project in a MechE area: materials testing, fluid dynamics experiment, renewable energy optimization, or biomechanical design.",
                        "icon": "FlaskConical",
                        "tags": ["ISEF Pipeline", "Research"],
                    },
                ],
                "projects": [
                    {
                        "title": "Complex CAD Assembly Project",
                        "description": "Design a multi-part mechanical assembly with proper tolerances, fasteners, and motion analysis. Use FEA to validate stress points.",
                        "icon": "Wrench",
                        "tags": ["CAD", "Advanced"],
                    },
                    {
                        "title": "Research with a Professor",
                        "description": "Join a university MechE lab. Materials science, robotics, fluid dynamics, or thermodynamics research — get real lab experience.",
                        "icon": "FlaskConical",
                        "tags": ["Research", "University"],
                    },
                ],
                "summer": [
                    {
                        "title": "Research Internship",
                        "description": "Spend the summer in a MechE lab. Hands-on work with testing equipment, prototyping, and data analysis gives you real engineering experience.",
                        "icon": "FlaskConical",
                        "tags": ["Research", "Priority"],
                    },
                    {
                        "title": "Apply to Elite Programs",
                        "description": "RSI (MIT), MITES (MIT), Clark Scholars — these programs demonstrate your academic potential and connect you with peers.",
                        "icon": "Star",
                        "tags": ["Elite Program"],
                    },
                    {
                        "title": "Advanced Manufacturing Skills",
                        "description": "Learn to use a lathe, mill, or laser cutter at a makerspace. CNC machining skills set you apart from pure CAD designers.",
                        "icon": "Wrench",
                        "tags": ["Manufacturing", "Hands-On"],
                    },
                ],
            },
            "11th": {
                "label": "11th Grade",
                "subtitle": "Peak Performance Year",
                "color": "violet",
                "academics": [
                    {
                        "title": "AP Physics C: E&M + College Math",
                        "description": "Take Multivariable Calculus and/or Differential Equations via dual enrollment. MechE grad school requires both.",
                        "icon": "BookOpen",
                        "tags": ["Beyond AP", "Math"],
                    },
                    {
                        "title": "AP English Language + AP US History",
                        "description": "Humanities APs show breadth. MIT's admissions explicitly values communication skills in engineers.",
                        "icon": "FileText",
                        "tags": ["AP Exam", "Breadth"],
                    },
                    {
                        "title": "SAT/ACT",
                        "description": "Target 1550+ SAT or 35+ ACT. Strong math section is especially important. Take in spring of junior year.",
                        "icon": "Target",
                        "tags": ["Standardized Tests"],
                    },
                ],
                "competitions": [
                    {
                        "title": "FIRST Robotics — Team Captain",
                        "description": "Lead the entire team or the mechanical subteam. Colleges want to see leadership growth over 3-4 years on a robotics team.",
                        "icon": "Wrench",
                        "tags": ["Robotics", "Captain"],
                    },
                    {
                        "title": "ISEF Qualification",
                        "description": "Push your engineering research through regional and state fairs. ISEF in an engineering category is a transformative achievement.",
                        "icon": "Trophy",
                        "tags": ["ISEF", "Elite"],
                    },
                    {
                        "title": "Engineering Design Competitions",
                        "description": "Enter ASME or SAE design competitions. These mirror real engineering challenges and are recognized by admissions committees.",
                        "icon": "Target",
                        "tags": ["ASME/SAE", "Design"],
                    },
                ],
                "projects": [
                    {
                        "title": "Research Publication / Presentation",
                        "description": "Submit findings from your research to a conference or journal. Even a poster presentation demonstrates research capability.",
                        "icon": "FlaskConical",
                        "tags": ["Publication", "Critical"],
                    },
                    {
                        "title": "Flagship Engineering Project",
                        "description": "Your portfolio centerpiece: a custom robot, an optimized mechanism, a solar-powered vehicle, or a novel manufacturing process.",
                        "icon": "Wrench",
                        "tags": ["Portfolio", "Flagship"],
                    },
                ],
                "summer": [
                    {
                        "title": "RSI or Research Program",
                        "description": "If accepted to RSI, go. Otherwise, a structured research internship where you produce tangible results.",
                        "icon": "Star",
                        "tags": ["Elite Program"],
                    },
                    {
                        "title": "College Application Prep",
                        "description": "Start essays. Research MIT MechE, Stanford ME, Georgia Tech ME, Purdue ME. Understand each program's strengths.",
                        "icon": "FileText",
                        "tags": ["Applications"],
                    },
                    {
                        "title": "Teacher Recommendations",
                        "description": "Ask your physics teacher and one other who can speak to your design skills. A robotics coach letter can be incredibly powerful.",
                        "icon": "GraduationCap",
                        "tags": ["Letters of Rec"],
                    },
                ],
            },
            "12th": {
                "label": "12th Grade",
                "subtitle": "Execute & Ship Applications",
                "color": "amber",
                "academics": [
                    {
                        "title": "Maintain Your GPA",
                        "description": "Keep up the rigor. Mid-year reports matter. Continue with challenging math and science courses.",
                        "icon": "BookOpen",
                        "tags": ["GPA", "Consistency"],
                    },
                    {
                        "title": "Additional APs / College Courses",
                        "description": "AP Biology, AP Statistics, or college-level engineering courses through dual enrollment. Show intellectual momentum.",
                        "icon": "Star",
                        "tags": ["AP Exams"],
                    },
                ],
                "competitions": [
                    {
                        "title": "Final Robotics Season",
                        "description": "Lead your team one last time. Focus on mentoring and passing on institutional knowledge. Document your multi-year robotics journey.",
                        "icon": "Wrench",
                        "tags": ["Robotics", "Legacy"],
                    },
                    {
                        "title": "ISEF Finals (if qualified)",
                        "description": "May competition. Awards are meaningful for waitlist and scholarship decisions.",
                        "icon": "Trophy",
                        "tags": ["ISEF"],
                    },
                ],
                "projects": [
                    {
                        "title": "Portfolio Documentation",
                        "description": "Create a comprehensive design portfolio: CAD renders, photos of builds, engineering drawings, and written design rationales.",
                        "icon": "FileText",
                        "tags": ["Portfolio"],
                    },
                ],
                "summer": [
                    {
                        "title": "Early Decision / Early Action (Nov 1)",
                        "description": "Apply EA to MIT and Caltech (non-binding). ED to Georgia Tech or Purdue if one is your top choice.",
                        "icon": "Target",
                        "tags": ["Applications", "Critical"],
                    },
                    {
                        "title": "Regular Decision (Jan 1-5)",
                        "description": "Apply to Stanford, Michigan, UIUC, Virginia Tech, and other strong MechE programs.",
                        "icon": "FileText",
                        "tags": ["Applications"],
                    },
                    {
                        "title": "Essays That Show the Builder in You",
                        "description": "Describe a design challenge you faced. Explain your iterative process. Connect your hands-on work to your future ambitions.",
                        "icon": "Lightbulb",
                        "tags": ["Essays", "Critical"],
                    },
                ],
            },
        },
        "key_insights": [
            {
                "icon": "Wrench",
                "icon_color": "text-amber-500",
                "title": "FIRST Robotics is the #1 MechE Signal",
                "description": "Multi-year commitment to FIRST Robotics, especially in a leadership role on the mechanical subsystem, is the strongest extracurricular signal for MechE applicants. It shows design thinking, teamwork, and real engineering experience.",
                "resources": ["FIRST Robotics", "Chief Delphi", "Onshape"],
            },
            {
                "icon": "Target",
                "icon_color": "text-violet-500",
                "title": "CAD Portfolio is Your Resume",
                "description": "A strong CAD portfolio demonstrates design thinking in a way that grades alone cannot. Document your designs with proper engineering drawings, assembly animations, and FEA analysis results.",
                "resources": ["SolidWorks", "Fusion 360", "GrabCAD"],
            },
            {
                "icon": "FlaskConical",
                "icon_color": "text-blue-500",
                "title": "Hands-On Manufacturing Matters",
                "description": "Knowing how things are made separates great designers from good ones. Learn to use a lathe, mill, 3D printer, and laser cutter. Understanding manufacturing constraints makes your designs practical.",
                "resources": [],
            },
            {
                "icon": "BookOpen",
                "icon_color": "text-emerald-500",
                "title": "Physics C: Mechanics is Non-Negotiable",
                "description": "AP Physics C: Mechanics is literally the introductory course for your major. A perfect score here is the baseline expectation for top MechE programs. Supplement with real-world applications of Newtonian mechanics.",
                "resources": ["MIT OpenCourseWare 2.001"],
            },
            {
                "icon": "Star",
                "icon_color": "text-rose-500",
                "title": "Georgia Tech and Purdue are Powerhouses",
                "description": "Don't overlook Georgia Tech ME (#2 public) and Purdue ME (#3 overall). Both have incredible facilities, industry connections, and co-op programs. They're not \"safety\" schools — they're destination programs.",
                "resources": [],
            },
        ],
        "ap_course_timeline": [
            {"grade": "9th", "courses": ["AP Computer Science A", "Honors Physics"]},
            {"grade": "10th", "courses": ["AP Physics C: Mechanics", "AP Calculus BC", "AP Chemistry"]},
            {"grade": "11th", "courses": ["AP Physics C: E&M", "AP English Language", "AP US History", "Multivariable Calculus (dual enrollment)"]},
            {"grade": "12th", "courses": ["AP Statistics or AP Biology", "Differential Equations (dual enrollment)"]},
        ],
        "competition_milestones": [
            {
                "title": "FIRST Robotics Progression",
                "steps": ["Team Member (9th)", "Sub-Lead (10th)", "Mechanical Lead (11th)", "Team Captain (12th)"],
                "color": "amber",
            },
            {
                "title": "Science Olympiad",
                "steps": ["Building Events (9th)", "Regional Medals (10th)", "State Qualifier (11th)", "National Competitor (12th)"],
                "color": "blue",
            },
            {
                "title": "Science Fair → ISEF",
                "steps": ["Explore Topics (9th)", "Regional Fair (10th)", "State Fair (11th)", "ISEF Finals (11th-12th)"],
                "color": "emerald",
            },
            {
                "title": "Design Competitions",
                "steps": ["TSA Chapters (9th)", "TSA State (10th)", "ASME/SAE Entry (11th)", "National Recognition (12th)"],
                "color": "violet",
            },
        ],
        "target_schools": [
            {"school": "MIT", "program": "Mechanical Engineering (Course 2)", "strategy": "EA non-binding. MIT wants makers. Show your build portfolio and research depth.", "deadline": "Nov 1 EA"},
            {"school": "Stanford", "program": "Mechanical Engineering", "strategy": "REA. Stanford ME emphasizes design thinking and impact. Show how you've solved real problems.", "deadline": "Nov 1 REA"},
            {"school": "Georgia Tech", "program": "Mechanical Engineering", "strategy": "EA available. #2 public MechE. Excellent co-op program and research opportunities.", "deadline": "Nov 1 EA"},
            {"school": "Purdue", "program": "Mechanical Engineering", "strategy": "EA available. Top-3 MechE nationally. Strong industry pipeline and hands-on curriculum.", "deadline": "Nov 1 EA"},
        ],
        "footer_note": "This plan is ambitious — that's intentional. MechE rewards students who can both design on a computer and build with their hands. You don't need to do everything — but you should demonstrate a clear progression from tinkerer to engineer.",
    },
}

# ──────────────────────────────────────────────────────────────────────
# 4. Civil Engineering
# ──────────────────────────────────────────────────────────────────────

CE_DATA = {
    "stem_area": "civil_engineering",
    "display_name": "Civil Engineering",
    "icon": "Building2",
    "description": "From bridge building to sustainable infrastructure — a four-year roadmap for aspiring civil engineers shaping the built environment.",
    "content": {
        "grade_data": {
            "9th": {
                "label": "9th Grade",
                "subtitle": "Explore the Built World",
                "color": "emerald",
                "academics": [
                    {
                        "title": "Honors Physics + Advanced Math",
                        "description": "Statics, dynamics, and structural analysis all rest on physics and math. Build the strongest possible foundation now.",
                        "icon": "BookOpen",
                        "tags": ["Physics", "Core"],
                    },
                    {
                        "title": "AP Environmental Science",
                        "description": "Modern civil engineering is inseparable from environmental concerns. This AP gives context for sustainable design and environmental impact analysis.",
                        "icon": "Leaf",
                        "tags": ["AP Exam", "Environment"],
                    },
                    {
                        "title": "Strong GPA Foundation",
                        "description": "Target unweighted 3.9+. Take honors across subjects. Civil engineering programs value well-rounded students.",
                        "icon": "Star",
                        "tags": ["GPA", "All Subjects"],
                    },
                ],
                "competitions": [
                    {
                        "title": "Future City Competition",
                        "description": "Design a city of the future with your team. This competition covers urban planning, infrastructure, and sustainability — the core of civil engineering.",
                        "icon": "Building2",
                        "tags": ["Future City", "Design"],
                    },
                    {
                        "title": "Science Olympiad — Bridges / Wind Power",
                        "description": "Bridges event teaches structural analysis and material efficiency. Wind Power tests your understanding of energy and mechanics.",
                        "icon": "Target",
                        "tags": ["Science Olympiad", "Structures"],
                    },
                    {
                        "title": "AMC 10",
                        "description": "Math competition results demonstrate quantitative ability. Civil engineering relies heavily on applied mathematics.",
                        "icon": "Target",
                        "tags": ["Math Competition"],
                    },
                ],
                "projects": [
                    {
                        "title": "Structural Design Experiments",
                        "description": "Build and test bridge and tower structures using balsa wood, pasta, or 3D printed components. Measure load-to-weight ratios and iterate designs.",
                        "icon": "Building2",
                        "tags": ["Structures", "Hands-On"],
                    },
                    {
                        "title": "Neighborhood Infrastructure Survey",
                        "description": "Document and analyze local infrastructure: bridges, roads, drainage systems. Identify problems and propose solutions. Great portfolio starter.",
                        "icon": "FileText",
                        "tags": ["Community", "Analysis"],
                    },
                ],
                "summer": [
                    {
                        "title": "Learn CAD for Civil Engineering",
                        "description": "Start with AutoCAD or SketchUp. Learn to create site plans, structural drawings, and basic 3D models of buildings and bridges.",
                        "icon": "Wrench",
                        "tags": ["CAD", "Foundation"],
                    },
                    {
                        "title": "Sustainability Project",
                        "description": "Start a project related to sustainability: rainwater harvesting, school garden design, energy audit of your home. Document the engineering approach.",
                        "icon": "Leaf",
                        "tags": ["Sustainability", "Impact"],
                    },
                    {
                        "title": "Contact Civil Engineering Firms",
                        "description": "Email local civil engineering and architecture firms about job shadowing. Seeing real projects in progress is eye-opening.",
                        "icon": "GraduationCap",
                        "tags": ["Industry", "Networking"],
                    },
                ],
            },
            "10th": {
                "label": "10th Grade",
                "subtitle": "Build Technical Depth",
                "color": "blue",
                "academics": [
                    {
                        "title": "AP Physics C: Mechanics",
                        "description": "Statics and dynamics — the core of structural engineering — are direct applications of AP Mechanics. This is your most critical AP.",
                        "icon": "FlaskConical",
                        "tags": ["AP Exam", "Critical"],
                    },
                    {
                        "title": "AP Calculus BC",
                        "description": "Structural analysis, fluid mechanics, and transportation engineering all require strong calculus skills.",
                        "icon": "BookOpen",
                        "tags": ["AP Exam", "Math"],
                    },
                    {
                        "title": "AP Computer Science A",
                        "description": "Modern CE uses computational tools extensively: FEA software, BIM, GIS, and data analysis for transportation planning.",
                        "icon": "Code",
                        "tags": ["AP Exam", "Programming"],
                    },
                ],
                "competitions": [
                    {
                        "title": "TSA — Structural Design",
                        "description": "Compete in structural engineering events. Design and build structures that maximize strength-to-weight ratios under specific loading conditions.",
                        "icon": "Building2",
                        "tags": ["TSA", "Design"],
                    },
                    {
                        "title": "Science Olympiad — Bridge Building",
                        "description": "Advanced bridge design competition. Apply truss analysis, material properties knowledge, and iterative testing methodology.",
                        "icon": "Target",
                        "tags": ["Science Olympiad", "Structures"],
                    },
                    {
                        "title": "Science Fair — Environmental Engineering",
                        "description": "Start an ISEF-track project in water treatment, soil analysis, air quality monitoring, or sustainable materials research.",
                        "icon": "FlaskConical",
                        "tags": ["ISEF Pipeline", "Research"],
                    },
                ],
                "projects": [
                    {
                        "title": "Structural Analysis with Software",
                        "description": "Learn basic FEA tools (SAP2000 student version, or free alternatives). Analyze beam deflection, truss forces, and stress distributions.",
                        "icon": "Code",
                        "tags": ["FEA", "Analysis"],
                    },
                    {
                        "title": "Environmental Impact Study",
                        "description": "Conduct a real environmental impact assessment for a local development project. Water runoff, traffic impact, or noise analysis.",
                        "icon": "Leaf",
                        "tags": ["Environment", "Community"],
                    },
                ],
                "summer": [
                    {
                        "title": "Civil Engineering Lab Research",
                        "description": "Join a university CE lab — structural testing, geotechnical, environmental engineering, or transportation. Hands-on research experience is invaluable.",
                        "icon": "FlaskConical",
                        "tags": ["Research", "Priority"],
                    },
                    {
                        "title": "Apply to Elite Programs",
                        "description": "RSI, MITES, or engineering-focused summer programs like GAMES at Ohio State or Engineering Summer Academy at Penn.",
                        "icon": "Star",
                        "tags": ["Elite Program"],
                    },
                    {
                        "title": "GIS and Mapping Skills",
                        "description": "Learn GIS (QGIS is free). Map local infrastructure, flood zones, or traffic patterns. Spatial analysis is central to modern CE.",
                        "icon": "Code",
                        "tags": ["GIS", "Technical"],
                    },
                ],
            },
            "11th": {
                "label": "11th Grade",
                "subtitle": "Peak Performance Year",
                "color": "violet",
                "academics": [
                    {
                        "title": "AP Physics C: E&M + College Math",
                        "description": "Take Multivariable Calculus or Differential Equations via dual enrollment. Also consider a college-level statics course if available.",
                        "icon": "BookOpen",
                        "tags": ["Beyond AP", "Math"],
                    },
                    {
                        "title": "AP English Language + AP US History",
                        "description": "Civil engineers write reports, present to city councils, and navigate public policy. Communication skills are essential to the profession.",
                        "icon": "FileText",
                        "tags": ["AP Exam", "Breadth"],
                    },
                    {
                        "title": "SAT/ACT",
                        "description": "Target 1500+ SAT or 34+ ACT. Strong math section is especially important for engineering admissions.",
                        "icon": "Target",
                        "tags": ["Standardized Tests"],
                    },
                ],
                "competitions": [
                    {
                        "title": "ISEF Qualification",
                        "description": "Push your environmental or structural engineering research through regional and state fairs. ISEF recognition is transformative.",
                        "icon": "Trophy",
                        "tags": ["ISEF", "Elite"],
                    },
                    {
                        "title": "ASCE Student Chapter Activities",
                        "description": "Connect with your local ASCE (American Society of Civil Engineers) section. Attend meetings, network, and participate in student competitions.",
                        "icon": "Building2",
                        "tags": ["ASCE", "Professional"],
                    },
                    {
                        "title": "Concrete Canoe / Steel Bridge (if available)",
                        "description": "Some high school teams participate in university-level ASCE competitions. These are outstanding for demonstrating engineering skills.",
                        "icon": "Wrench",
                        "tags": ["ASCE", "Advanced"],
                    },
                ],
                "projects": [
                    {
                        "title": "Research Publication",
                        "description": "Publish or present research findings. Environmental engineering, transportation, structural analysis — any CE subfield counts.",
                        "icon": "FlaskConical",
                        "tags": ["Publication", "Critical"],
                    },
                    {
                        "title": "Community Engineering Project",
                        "description": "Design a real solution for a community need: accessible park design, school traffic analysis, stormwater management plan.",
                        "icon": "Building2",
                        "tags": ["Community Impact", "Portfolio"],
                    },
                ],
                "summer": [
                    {
                        "title": "Research or Engineering Internship",
                        "description": "University lab research or internship at a CE firm. Real-world exposure to project management, site work, and design review processes.",
                        "icon": "FlaskConical",
                        "tags": ["Research", "Priority"],
                    },
                    {
                        "title": "College Application Prep",
                        "description": "Start essays. Research MIT CEE, Stanford CEE, UC Berkeley CE, Georgia Tech CE. Understand each program's specializations.",
                        "icon": "FileText",
                        "tags": ["Applications"],
                    },
                    {
                        "title": "Teacher Recommendations",
                        "description": "Ask your physics teacher, math teacher, or a mentor who can speak to your engineering problem-solving abilities.",
                        "icon": "GraduationCap",
                        "tags": ["Letters of Rec"],
                    },
                ],
            },
            "12th": {
                "label": "12th Grade",
                "subtitle": "Execute & Ship Applications",
                "color": "amber",
                "academics": [
                    {
                        "title": "Maintain Your GPA",
                        "description": "Mid-year reports go to colleges. Continue challenging yourself with advanced math and science.",
                        "icon": "BookOpen",
                        "tags": ["GPA", "Consistency"],
                    },
                    {
                        "title": "Additional APs / College Courses",
                        "description": "AP Statistics (data analysis for CE), AP Biology (environmental), or college-level engineering mechanics.",
                        "icon": "Star",
                        "tags": ["AP Exams"],
                    },
                ],
                "competitions": [
                    {
                        "title": "Final Competition Season",
                        "description": "Lead your Science Olympiad or TSA team. Mentor younger students. Your leadership growth over 4 years tells a powerful story.",
                        "icon": "Target",
                        "tags": ["Leadership", "Legacy"],
                    },
                    {
                        "title": "ISEF Finals (if qualified)",
                        "description": "May competition. Awards matter for waitlist decisions and major scholarship applications.",
                        "icon": "Trophy",
                        "tags": ["ISEF"],
                    },
                ],
                "projects": [
                    {
                        "title": "Complete Your Engineering Portfolio",
                        "description": "Compile your structural designs, environmental studies, CAD work, and community projects into a professional portfolio.",
                        "icon": "FileText",
                        "tags": ["Portfolio"],
                    },
                ],
                "summer": [
                    {
                        "title": "Early Decision / Early Action (Nov 1)",
                        "description": "Apply EA to MIT and Caltech (non-binding). Consider ED to your top choice among Georgia Tech, Cornell, or Purdue.",
                        "icon": "Target",
                        "tags": ["Applications", "Critical"],
                    },
                    {
                        "title": "Regular Decision (Jan 1-5)",
                        "description": "Apply broadly: UC Berkeley CE, Stanford CEE, Michigan CEE, Virginia Tech, UT Austin — all outstanding CE programs.",
                        "icon": "FileText",
                        "tags": ["Applications"],
                    },
                    {
                        "title": "Essays That Show Your Vision",
                        "description": "Write about infrastructure, sustainability, or a community problem you want to solve. Show you see CE as a way to improve lives.",
                        "icon": "Lightbulb",
                        "tags": ["Essays", "Critical"],
                    },
                ],
            },
        },
        "key_insights": [
            {
                "icon": "Leaf",
                "icon_color": "text-emerald-500",
                "title": "Sustainability is the Future of CE",
                "description": "Climate resilience, green infrastructure, and sustainable materials are transforming civil engineering. Demonstrating environmental awareness alongside structural skills positions you as a forward-thinking candidate.",
                "resources": ["ASCE Sustainability", "LEED Certification Guide"],
            },
            {
                "icon": "Building2",
                "icon_color": "text-amber-500",
                "title": "Infrastructure is a National Priority",
                "description": "With trillions being invested in infrastructure, CE graduates face enormous demand. Bridges, water systems, transportation, and energy grids all need modernization. This is a field with clear societal impact.",
                "resources": [],
            },
            {
                "icon": "FlaskConical",
                "icon_color": "text-violet-500",
                "title": "Research Spans Many Subfields",
                "description": "CE research ranges from structural engineering and geotechnics to water resources, transportation, and construction management. Find the subfield that excites you most and pursue research early.",
                "resources": [],
            },
            {
                "icon": "Code",
                "icon_color": "text-blue-500",
                "title": "Computational Skills Are Increasingly Valued",
                "description": "BIM, FEA, GIS, and data-driven transportation planning all require computational fluency. Programming skills (Python, MATLAB) differentiate you from traditional CE applicants.",
                "resources": ["QGIS", "SAP2000", "AutoCAD"],
            },
            {
                "icon": "GraduationCap",
                "icon_color": "text-rose-500",
                "title": "Community Impact Resonates in Applications",
                "description": "Civil engineering is inherently about serving communities. Projects that improve local infrastructure, accessibility, or environmental quality are powerful application material.",
                "resources": [],
            },
        ],
        "ap_course_timeline": [
            {"grade": "9th", "courses": ["AP Environmental Science", "Honors Physics"]},
            {"grade": "10th", "courses": ["AP Physics C: Mechanics", "AP Calculus BC", "AP Computer Science A"]},
            {"grade": "11th", "courses": ["AP Physics C: E&M", "AP English Language", "AP US History", "Multivariable Calculus (dual enrollment)"]},
            {"grade": "12th", "courses": ["AP Statistics", "AP Biology or additional science", "Differential Equations (dual enrollment)"]},
        ],
        "competition_milestones": [
            {
                "title": "Future City / TSA Progression",
                "steps": ["Future City Regional (9th)", "TSA State Events (10th)", "TSA National (11th)", "Competition Leadership (12th)"],
                "color": "amber",
            },
            {
                "title": "Science Olympiad",
                "steps": ["Bridges Event (9th)", "Regional Medals (10th)", "State Qualifier (11th)", "National Competitor (12th)"],
                "color": "blue",
            },
            {
                "title": "Science Fair → ISEF",
                "steps": ["School Fair (9th)", "Regional Fair (10th)", "State Fair (11th)", "ISEF Finals (11th-12th)"],
                "color": "emerald",
            },
            {
                "title": "Professional Engagement",
                "steps": ["Job Shadowing (9th)", "ASCE Student Contact (10th)", "ASCE Events (11th)", "Mentorship Role (12th)"],
                "color": "violet",
            },
        ],
        "target_schools": [
            {"school": "MIT", "program": "Civil & Environmental Engineering", "strategy": "EA non-binding. MIT CEE combines infrastructure with environmental science. Show research potential.", "deadline": "Nov 1 EA"},
            {"school": "Stanford", "program": "Civil & Environmental Engineering", "strategy": "REA. Stanford CEE emphasizes sustainability and innovation. Essays about real-world impact matter.", "deadline": "Nov 1 REA"},
            {"school": "UC Berkeley", "program": "Civil Engineering", "strategy": "Apply directly to CoE. Top-ranked public CE program. Strong in structural and environmental.", "deadline": "Nov 30 UC Deadline"},
            {"school": "Georgia Tech", "program": "Civil Engineering", "strategy": "EA available. Excellent facilities and industry connections. Strong in structural and transportation.", "deadline": "Nov 1 EA"},
        ],
        "footer_note": "This plan is ambitious — that's intentional. Civil engineering rewards students who combine technical strength with a genuine passion for improving communities. You don't need to do everything — find the CE subfield that excites you and build depth there.",
    },
}

# ──────────────────────────────────────────────────────────────────────
# 5. Biology
# ──────────────────────────────────────────────────────────────────────

BIO_DATA = {
    "stem_area": "biology",
    "display_name": "Biology",
    "icon": "Microscope",
    "description": "From USABO medalist to Harvard MCB — a four-year roadmap for aspiring biologists targeting top research programs.",
    "content": {
        "grade_data": {
            "9th": {
                "label": "9th Grade",
                "subtitle": "Build the Scientific Foundation",
                "color": "emerald",
                "academics": [
                    {
                        "title": "AP Biology",
                        "description": "Take AP Bio as early as possible. This is your flagship course. Aim for a 5 and genuine mastery of molecular and cellular biology.",
                        "icon": "Microscope",
                        "tags": ["AP Exam", "Critical"],
                    },
                    {
                        "title": "Honors/AP Math Track",
                        "description": "Biology is increasingly quantitative. Take the most advanced math available. Biostatistics, bioinformatics, and computational biology all require strong math.",
                        "icon": "BookOpen",
                        "tags": ["Math", "Core"],
                    },
                    {
                        "title": "Strong GPA Foundation",
                        "description": "Target unweighted 3.9+. Take honors in all available subjects. Top biology programs are at highly selective universities.",
                        "icon": "Star",
                        "tags": ["GPA", "All Subjects"],
                    },
                ],
                "competitions": [
                    {
                        "title": "USABO (USA Biology Olympiad)",
                        "description": "Start preparing for the USABO Open Exam in February. Use Campbell Biology and past exam questions. The goal is Semifinalist by end of 9th grade.",
                        "icon": "Microscope",
                        "tags": ["USABO", "Critical"],
                    },
                    {
                        "title": "Science Olympiad — Life Science Events",
                        "description": "Compete in Anatomy & Physiology, Disease Detectives, and Ecology. These events build breadth across biological disciplines.",
                        "icon": "Target",
                        "tags": ["Science Olympiad", "Biology"],
                    },
                    {
                        "title": "Science Fair — Biology Project",
                        "description": "Start a biology science fair project. Ecology, plant biology, or microbiology are accessible starting points that can grow into ISEF-level work.",
                        "icon": "FlaskConical",
                        "tags": ["Science Fair", "Start Early"],
                    },
                ],
                "projects": [
                    {
                        "title": "Independent Biology Experiment",
                        "description": "Design and execute a controlled experiment. Bacterial growth, plant responses, enzyme kinetics — learn proper experimental methodology.",
                        "icon": "FlaskConical",
                        "tags": ["Experiment", "Methodology"],
                    },
                    {
                        "title": "Learn Bioinformatics Basics",
                        "description": "Start learning Python and explore NCBI databases, BLAST searches, and basic sequence analysis. Computational biology is the fastest-growing area.",
                        "icon": "Code",
                        "tags": ["Bioinformatics", "Programming"],
                    },
                ],
                "summer": [
                    {
                        "title": "USABO Intensive Study",
                        "description": "Deepen your biology knowledge systematically. Work through Campbell Biology thoroughly. Start molecular biology and genetics in depth.",
                        "icon": "Microscope",
                        "tags": ["USABO", "Priority"],
                    },
                    {
                        "title": "Volunteer in a Research Lab",
                        "description": "Contact university biology professors. Even basic tasks (washing glassware, maintaining cultures) give you exposure to real lab culture.",
                        "icon": "FlaskConical",
                        "tags": ["Research", "Networking"],
                    },
                    {
                        "title": "Field Biology Experience",
                        "description": "Participate in a nature survey, wildlife monitoring, or conservation project. Field experience adds dimension to your biology profile.",
                        "icon": "Leaf",
                        "tags": ["Field Work", "Ecology"],
                    },
                ],
            },
            "10th": {
                "label": "10th Grade",
                "subtitle": "Deepen Expertise & Start Research",
                "color": "blue",
                "academics": [
                    {
                        "title": "AP Chemistry",
                        "description": "Chemistry is the language of molecular biology. Organic chemistry, biochemistry, and pharmacology all build on AP Chem foundations.",
                        "icon": "FlaskConical",
                        "tags": ["AP Exam", "Essential"],
                    },
                    {
                        "title": "AP Calculus BC",
                        "description": "Required for all top biology programs. Quantitative biology, biostatistics, and modeling all demand strong calculus skills.",
                        "icon": "BookOpen",
                        "tags": ["AP Exam", "Math"],
                    },
                    {
                        "title": "AP Physics C: Mechanics or AP Physics 1",
                        "description": "Physics is increasingly relevant to biology (biophysics, biomechanics). Take the most rigorous physics available.",
                        "icon": "FlaskConical",
                        "tags": ["AP Exam", "Science"],
                    },
                ],
                "competitions": [
                    {
                        "title": "USABO — Target Top 20 (Study Camp)",
                        "description": "This is your big push. USABO Study Camp (top 20 in the country) is the single strongest biology competition credential. Train intensively.",
                        "icon": "Microscope",
                        "tags": ["USABO", "Critical"],
                    },
                    {
                        "title": "Science Olympiad — National Events",
                        "description": "Aim for national-level competition. Lead your team in biology events. Strong Science Olympiad performance supplements your USABO work.",
                        "icon": "Target",
                        "tags": ["Science Olympiad", "National"],
                    },
                    {
                        "title": "Science Fair — ISEF Track",
                        "description": "Advance your biology research project through regional and state science fairs. This is your pipeline to ISEF.",
                        "icon": "FlaskConical",
                        "tags": ["ISEF Pipeline", "Research"],
                    },
                ],
                "projects": [
                    {
                        "title": "Wet Lab Research Project",
                        "description": "Secure a position in a university biology lab doing real research. Molecular biology, genetics, microbiology — get hands-on with serious techniques.",
                        "icon": "Microscope",
                        "tags": ["Lab Research", "Critical"],
                    },
                    {
                        "title": "Computational Biology Project",
                        "description": "Analyze genomic data, model protein structures, or study phylogenetics computationally. Combine your programming and biology skills.",
                        "icon": "Code",
                        "tags": ["Bioinformatics", "Interdisciplinary"],
                    },
                ],
                "summer": [
                    {
                        "title": "University Research Internship",
                        "description": "Spend the summer in a biology lab. Learn techniques: PCR, gel electrophoresis, cell culture, microscopy. Aim for a concrete research question.",
                        "icon": "FlaskConical",
                        "tags": ["Research", "Priority"],
                    },
                    {
                        "title": "Apply to Elite Programs",
                        "description": "RSI (MIT), SSP (biology track), Garcia Program (Stony Brook), Jackson Lab Summer Student Program. These are transformative experiences.",
                        "icon": "Star",
                        "tags": ["Elite Program"],
                    },
                    {
                        "title": "USABO Study Camp Prep",
                        "description": "If you didn't make camp this year, intensify preparation for next year's exam. Study Alberts 'Molecular Biology of the Cell' and Lehninger's Biochemistry.",
                        "icon": "Microscope",
                        "tags": ["USABO", "Advanced Study"],
                    },
                ],
            },
            "11th": {
                "label": "11th Grade",
                "subtitle": "Peak Performance Year",
                "color": "violet",
                "academics": [
                    {
                        "title": "AP Physics C + College Biology Courses",
                        "description": "Take AP Physics C (Mechanics or E&M). If available, take college-level biochemistry or genetics via dual enrollment.",
                        "icon": "BookOpen",
                        "tags": ["Beyond AP", "Advanced"],
                    },
                    {
                        "title": "AP English Language + AP US History",
                        "description": "Humanities APs show breadth. Science communication is increasingly valued — strong writing skills matter for grant proposals and publications.",
                        "icon": "FileText",
                        "tags": ["AP Exam", "Breadth"],
                    },
                    {
                        "title": "AP Statistics",
                        "description": "Statistical analysis is essential for biological research. Understanding experimental design, p-values, and data analysis is non-negotiable.",
                        "icon": "BookOpen",
                        "tags": ["AP Exam", "Research Tool"],
                    },
                ],
                "competitions": [
                    {
                        "title": "USABO — Study Camp or Top 50",
                        "description": "Final push for USABO. Making Study Camp (top 20) is extraordinary. Even top 50 (Semifinalist) is a very strong credential.",
                        "icon": "Microscope",
                        "tags": ["USABO", "Critical"],
                    },
                    {
                        "title": "ISEF Qualification",
                        "description": "Present your research at regional and state science fairs. Aim for ISEF qualification. A strong ISEF showing can be application-defining.",
                        "icon": "Trophy",
                        "tags": ["ISEF", "Elite"],
                    },
                    {
                        "title": "Science Olympiad — Leadership Role",
                        "description": "Captain or co-captain your team. Lead in biology events while mentoring younger competitors.",
                        "icon": "Target",
                        "tags": ["Science Olympiad", "Leadership"],
                    },
                ],
                "projects": [
                    {
                        "title": "Research Publication",
                        "description": "Submit to a journal or present at a conference. First-author or co-author papers demonstrate genuine research capability. Even a preprint on bioRxiv counts.",
                        "icon": "FlaskConical",
                        "tags": ["Publication", "Critical"],
                    },
                    {
                        "title": "Science Communication Initiative",
                        "description": "Start a biology blog, YouTube channel, or lead a school bio club. Teaching and communicating science shows depth of understanding.",
                        "icon": "GraduationCap",
                        "tags": ["Leadership", "Outreach"],
                    },
                ],
                "summer": [
                    {
                        "title": "RSI or Elite Research Program",
                        "description": "RSI, SSP, or a focused research internship at a top university lab. Prioritize depth of research experience and a tangible output.",
                        "icon": "Star",
                        "tags": ["Elite Program"],
                    },
                    {
                        "title": "College Application Prep",
                        "description": "Start essays. Research MIT Biology, Harvard MCB, Stanford Biology, Caltech Biology, Johns Hopkins BME. Visit if possible.",
                        "icon": "FileText",
                        "tags": ["Applications"],
                    },
                    {
                        "title": "Teacher Recommendations",
                        "description": "Ask your biology teacher (who should write your strongest letter) and one other teacher who can speak to your intellectual curiosity.",
                        "icon": "GraduationCap",
                        "tags": ["Letters of Rec"],
                    },
                ],
            },
            "12th": {
                "label": "12th Grade",
                "subtitle": "Execute & Ship Applications",
                "color": "amber",
                "academics": [
                    {
                        "title": "Maintain Your GPA",
                        "description": "Continue with rigorous courses. Mid-year reports go to colleges. Don't let senioritis undermine 3 years of hard work.",
                        "icon": "BookOpen",
                        "tags": ["GPA", "Consistency"],
                    },
                    {
                        "title": "College-Level Science Courses",
                        "description": "Biochemistry, organic chemistry, or advanced biology through dual enrollment. Show you're already doing college-level work.",
                        "icon": "Star",
                        "tags": ["Beyond AP"],
                    },
                ],
                "competitions": [
                    {
                        "title": "Final USABO (February)",
                        "description": "Your last shot at USABO. Even if you've already qualified before, a strong performance in 12th grade reinforces your profile.",
                        "icon": "Microscope",
                        "tags": ["USABO", "Final"],
                    },
                    {
                        "title": "ISEF Finals (if qualified)",
                        "description": "May competition. Awards still influence waitlist decisions and scholarship offers.",
                        "icon": "Trophy",
                        "tags": ["ISEF"],
                    },
                ],
                "projects": [
                    {
                        "title": "Finalize Research & Publications",
                        "description": "Push any in-progress papers to submission. Update your research portfolio. Compile a clear narrative of your scientific journey.",
                        "icon": "FileText",
                        "tags": ["Portfolio", "Research"],
                    },
                ],
                "summer": [
                    {
                        "title": "Early Decision / Early Action (Nov 1)",
                        "description": "Apply EA to MIT and Caltech (non-binding). Apply ED to Johns Hopkins or your top choice. Harvard REA if Harvard is #1.",
                        "icon": "Target",
                        "tags": ["Applications", "Critical"],
                    },
                    {
                        "title": "Regular Decision (Jan 1-5)",
                        "description": "Apply to Stanford, Yale, Princeton, Duke, WUSTL, and other strong biology programs.",
                        "icon": "FileText",
                        "tags": ["Applications"],
                    },
                    {
                        "title": "Essays That Show Your Scientific Identity",
                        "description": "Write about your research journey. Describe a moment of discovery. Connect your lab experience to the questions you want to answer in college and beyond.",
                        "icon": "Lightbulb",
                        "tags": ["Essays", "Critical"],
                    },
                ],
            },
        },
        "key_insights": [
            {
                "icon": "Microscope",
                "icon_color": "text-amber-500",
                "title": "USABO is the Strongest Biology Signal",
                "description": "USABO Study Camp (top 20 nationally) is to biology what USACO Platinum is to CS. Even Semifinalist status (top 50) is a very powerful credential. Start preparing in 9th grade with Campbell Biology.",
                "resources": ["Campbell Biology", "Alberts Molecular Biology", "USABO Past Exams"],
            },
            {
                "icon": "FlaskConical",
                "icon_color": "text-violet-500",
                "title": "Wet Lab Experience is Essential",
                "description": "Biology admissions committees want to see that you've done real lab work — not just read about it. PCR, gel electrophoresis, cell culture, microscopy. The hands-on skills are what separate serious applicants.",
                "resources": [],
            },
            {
                "icon": "Code",
                "icon_color": "text-blue-500",
                "title": "Computational Biology is the Future",
                "description": "Genomics, proteomics, and systems biology are increasingly computational. Students who combine wet lab skills with programming (Python, R) and bioinformatics tools are highly valued.",
                "resources": ["Rosalind (bioinformatics)", "NCBI", "Biopython"],
            },
            {
                "icon": "Star",
                "icon_color": "text-emerald-500",
                "title": "Publish Early, Publish Often",
                "description": "In biology, research publication is the gold standard. Even a co-author position on a real paper demonstrates research capability. bioRxiv preprints are perfectly acceptable.",
                "resources": [],
            },
            {
                "icon": "GraduationCap",
                "icon_color": "text-rose-500",
                "title": "Johns Hopkins and Harvard MCB Are Destinations",
                "description": "Johns Hopkins (which has a dedicated BME program for undergrads) and Harvard's MCB (Molecular and Cellular Biology) are two of the strongest biology programs. Research their specific offerings and tailor your applications.",
                "resources": [],
            },
        ],
        "ap_course_timeline": [
            {"grade": "9th", "courses": ["AP Biology"]},
            {"grade": "10th", "courses": ["AP Chemistry", "AP Calculus BC", "AP Physics 1 or C: Mechanics"]},
            {"grade": "11th", "courses": ["AP Physics C", "AP English Language", "AP US History", "AP Statistics"]},
            {"grade": "12th", "courses": ["College-level Biochemistry (dual enrollment)", "Additional APs as available"]},
        ],
        "competition_milestones": [
            {
                "title": "USABO Progression",
                "steps": ["Open Exam (9th)", "Semifinalist Top 500 (10th)", "Top 50 (11th)", "Study Camp Top 20 (11th-12th)"],
                "color": "amber",
            },
            {
                "title": "Science Olympiad",
                "steps": ["Bio Events (9th)", "Regional Medals (10th)", "State Qualifier (11th)", "National Competitor (12th)"],
                "color": "blue",
            },
            {
                "title": "Science Fair → ISEF",
                "steps": ["School Fair (9th)", "Regional Fair (10th)", "State Fair (11th)", "ISEF Finals (11th-12th)"],
                "color": "emerald",
            },
            {
                "title": "Research Pipeline",
                "steps": ["Lab Volunteer (9th)", "Research Assistant (10th)", "Independent Project (11th)", "Publication (11th-12th)"],
                "color": "violet",
            },
        ],
        "target_schools": [
            {"school": "MIT", "program": "Biology (Course 7)", "strategy": "EA non-binding. MIT Bio is quantitative and research-intensive. Show computational + wet lab skills.", "deadline": "Nov 1 EA"},
            {"school": "Harvard", "program": "Molecular & Cellular Biology", "strategy": "REA. Harvard MCB is world-class. Demonstrate research depth and intellectual curiosity.", "deadline": "Nov 1 REA"},
            {"school": "Stanford", "program": "Biology", "strategy": "REA. Stanford Bio emphasizes interdisciplinary approaches. Show breadth across biology subfields.", "deadline": "Nov 1 REA"},
            {"school": "Johns Hopkins", "program": "Biology / BME", "strategy": "ED available. Strongest undergraduate research culture in biology. ED if JHU is your top choice.", "deadline": "Nov 1 ED"},
        ],
        "footer_note": "This plan is ambitious — that's intentional. Biology rewards students who combine deep theoretical knowledge (USABO) with real research experience (lab work, publications). You don't need to do everything — but a strong USABO result plus meaningful research is the winning combination.",
    },
}

# ──────────────────────────────────────────────────────────────────────
# 6. Chemistry
# ──────────────────────────────────────────────────────────────────────

CHEM_DATA = {
    "stem_area": "chemistry",
    "display_name": "Chemistry",
    "icon": "FlaskConical",
    "description": "From USNCO camp to Caltech Chemistry — a four-year roadmap for aspiring chemists targeting elite research programs.",
    "content": {
        "grade_data": {
            "9th": {
                "label": "9th Grade",
                "subtitle": "Ignite the Reaction",
                "color": "emerald",
                "academics": [
                    {
                        "title": "Honors Chemistry (or AP Chemistry if available)",
                        "description": "Start chemistry as early as possible. If your school allows AP Chem in 9th grade, take it. Otherwise, take honors and self-study AP material.",
                        "icon": "FlaskConical",
                        "tags": ["Chemistry", "Core"],
                    },
                    {
                        "title": "Honors/AP Math Track",
                        "description": "Chemistry is deeply mathematical — thermodynamics, kinetics, quantum mechanics all require strong math. Get ahead on the math track.",
                        "icon": "BookOpen",
                        "tags": ["Math", "Core"],
                    },
                    {
                        "title": "Strong GPA Foundation",
                        "description": "Target unweighted 3.9+. Take honors in all available subjects. The universities with the best chemistry programs are highly selective.",
                        "icon": "Star",
                        "tags": ["GPA", "All Subjects"],
                    },
                ],
                "competitions": [
                    {
                        "title": "USNCO (US National Chemistry Olympiad)",
                        "description": "Start preparing for the USNCO local exam in March. Study Zumdahl or Silberberg thoroughly. The goal is qualification to the national exam by end of 9th or 10th grade.",
                        "icon": "FlaskConical",
                        "tags": ["USNCO", "Critical"],
                    },
                    {
                        "title": "Science Olympiad — Chemistry Events",
                        "description": "Compete in Chem Lab and Forensics events. These build practical lab skills and chemical analysis techniques alongside competition experience.",
                        "icon": "Target",
                        "tags": ["Science Olympiad", "Lab Skills"],
                    },
                    {
                        "title": "AMC 10",
                        "description": "Math competitions complement a chemistry profile strongly. Physical chemistry and quantum chemistry are deeply mathematical.",
                        "icon": "Target",
                        "tags": ["Math Competition"],
                    },
                ],
                "projects": [
                    {
                        "title": "Home Chemistry Experiments",
                        "description": "Set up safe home experiments: crystal growing, electrochemistry, spectroscopy with DIY spectrometers. Document everything like a real lab notebook.",
                        "icon": "FlaskConical",
                        "tags": ["Experiments", "Lab Skills"],
                    },
                    {
                        "title": "Learn Chemical Visualization Tools",
                        "description": "Learn to use Avogadro, ChemDraw, or PyMOL. Visualizing molecular structures and reactions deepens understanding beyond textbooks.",
                        "icon": "Code",
                        "tags": ["Software", "Visualization"],
                    },
                ],
                "summer": [
                    {
                        "title": "USNCO Preparation Deep Dive",
                        "description": "Study organic chemistry basics, thermodynamics, and equilibrium in depth. Work through past USNCO exams systematically.",
                        "icon": "FlaskConical",
                        "tags": ["USNCO", "Priority"],
                    },
                    {
                        "title": "Contact Chemistry Professors",
                        "description": "Email professors at local universities. Chemistry labs often welcome high school students for summer work — even basic synthesis or analytical work is valuable.",
                        "icon": "GraduationCap",
                        "tags": ["Research", "Networking"],
                    },
                    {
                        "title": "Read Beyond the Textbook",
                        "description": "Read popular chemistry books and start on Clayden's Organic Chemistry or Atkins' Physical Chemistry. Build the foundation for advanced study.",
                        "icon": "BookOpen",
                        "tags": ["Self-Study", "Advanced"],
                    },
                ],
            },
            "10th": {
                "label": "10th Grade",
                "subtitle": "Master the Fundamentals",
                "color": "blue",
                "academics": [
                    {
                        "title": "AP Chemistry",
                        "description": "If you haven't taken it yet, this is the year. Aim for a perfect score. This course should feel like a review given your competition prep.",
                        "icon": "FlaskConical",
                        "tags": ["AP Exam", "Critical"],
                    },
                    {
                        "title": "AP Calculus BC",
                        "description": "Essential for physical chemistry and chemical engineering. The math must be strong before you encounter thermodynamics and quantum mechanics.",
                        "icon": "BookOpen",
                        "tags": ["AP Exam", "Math"],
                    },
                    {
                        "title": "AP Biology",
                        "description": "Biochemistry bridges chemistry and biology. AP Bio provides the biological context for understanding enzyme kinetics, metabolism, and drug design.",
                        "icon": "Microscope",
                        "tags": ["AP Exam", "Interdisciplinary"],
                    },
                ],
                "competitions": [
                    {
                        "title": "USNCO — National Exam & Study Camp",
                        "description": "Qualify for the national exam and aim for Study Camp (top 20). USNCO Study Camp selection is one of the most elite STEM credentials for high schoolers.",
                        "icon": "FlaskConical",
                        "tags": ["USNCO", "Critical"],
                    },
                    {
                        "title": "Science Olympiad — National Level",
                        "description": "Push for state and national competitions. Lead your team in Chem Lab and related events. Demonstrate mastery of practical chemistry.",
                        "icon": "Target",
                        "tags": ["Science Olympiad", "National"],
                    },
                    {
                        "title": "Science Fair — Chemistry Research",
                        "description": "Start an ISEF-track project: synthesis of novel compounds, green chemistry, materials characterization, or computational chemistry.",
                        "icon": "FlaskConical",
                        "tags": ["ISEF Pipeline", "Research"],
                    },
                ],
                "projects": [
                    {
                        "title": "University Lab Research",
                        "description": "Secure a position in a chemistry research lab. Organic synthesis, analytical chemistry, materials science — get real bench experience with proper techniques.",
                        "icon": "FlaskConical",
                        "tags": ["Lab Research", "Critical"],
                    },
                    {
                        "title": "Computational Chemistry Project",
                        "description": "Learn to use computational chemistry tools (Gaussian, ORCA, or Python-based packages). Model molecular properties, reaction mechanisms, or material properties.",
                        "icon": "Code",
                        "tags": ["Computational", "Interdisciplinary"],
                    },
                ],
                "summer": [
                    {
                        "title": "Research Internship",
                        "description": "Full-time summer research in a chemistry lab. Learn synthesis techniques, analytical instruments (NMR, mass spec, IR), and research methodology.",
                        "icon": "FlaskConical",
                        "tags": ["Research", "Priority"],
                    },
                    {
                        "title": "Apply to Elite Programs",
                        "description": "RSI (MIT), Clark Scholars, RISE (Germany), or chemistry-specific programs like PROMYS (math-adjacent). These demonstrate elite academic potential.",
                        "icon": "Star",
                        "tags": ["Elite Program"],
                    },
                    {
                        "title": "Organic Chemistry Self-Study",
                        "description": "Work through Clayden's Organic Chemistry or Klein. Understanding mechanisms, stereochemistry, and retrosynthesis is critical for USNCO and research.",
                        "icon": "BookOpen",
                        "tags": ["Organic Chemistry", "Self-Study"],
                    },
                ],
            },
            "11th": {
                "label": "11th Grade",
                "subtitle": "Peak Performance Year",
                "color": "violet",
                "academics": [
                    {
                        "title": "AP Physics C + College Chemistry",
                        "description": "Take AP Physics C (Mechanics and/or E&M). If possible, take organic chemistry or physical chemistry via dual enrollment.",
                        "icon": "BookOpen",
                        "tags": ["Beyond AP", "Advanced"],
                    },
                    {
                        "title": "Multivariable Calculus + Linear Algebra",
                        "description": "Via dual enrollment. Physical chemistry requires multivariable calc; computational chemistry uses linear algebra extensively.",
                        "icon": "BookOpen",
                        "tags": ["Beyond AP", "Math"],
                    },
                    {
                        "title": "AP English Language + AP US History",
                        "description": "Humanities APs show intellectual breadth. Scientific writing is a crucial skill — top chemistry journals demand excellent communication.",
                        "icon": "FileText",
                        "tags": ["AP Exam", "Breadth"],
                    },
                ],
                "competitions": [
                    {
                        "title": "USNCO Study Camp (if not already)",
                        "description": "Final push for Study Camp. Even top 50 performance is exceptional. This is the year your competition profile should peak.",
                        "icon": "FlaskConical",
                        "tags": ["USNCO", "Critical"],
                    },
                    {
                        "title": "ISEF Qualification",
                        "description": "Push your chemistry research through regional and state fairs. ISEF in chemistry or materials science is extraordinary.",
                        "icon": "Trophy",
                        "tags": ["ISEF", "Elite"],
                    },
                    {
                        "title": "ACS Chemistry Events",
                        "description": "Participate in American Chemical Society regional events, poster sessions, or undergraduate symposia. Professional society engagement matters.",
                        "icon": "FlaskConical",
                        "tags": ["ACS", "Professional"],
                    },
                ],
                "projects": [
                    {
                        "title": "Research Publication",
                        "description": "Submit to a chemistry journal or present at a conference. First-author or co-author on a real paper is the gold standard.",
                        "icon": "FlaskConical",
                        "tags": ["Publication", "Critical"],
                    },
                    {
                        "title": "Science Communication",
                        "description": "Start a chemistry blog, tutor peers, or create educational content. Demonstrating your ability to explain complex chemistry shows deep understanding.",
                        "icon": "GraduationCap",
                        "tags": ["Leadership", "Outreach"],
                    },
                ],
                "summer": [
                    {
                        "title": "RSI or Elite Research Program",
                        "description": "If accepted to RSI, go. Otherwise, a dedicated summer research project aiming for a publication-quality result.",
                        "icon": "Star",
                        "tags": ["Elite Program"],
                    },
                    {
                        "title": "College Application Prep",
                        "description": "Start essays. Research Caltech Chemistry, MIT Chemistry, Stanford Chemistry, Harvard Chemistry. Understand faculty research areas.",
                        "icon": "FileText",
                        "tags": ["Applications"],
                    },
                    {
                        "title": "Teacher Recommendations",
                        "description": "Ask your chemistry teacher (essential) and one other teacher. A research mentor recommendation letter can be incredibly powerful as a supplemental letter.",
                        "icon": "GraduationCap",
                        "tags": ["Letters of Rec"],
                    },
                ],
            },
            "12th": {
                "label": "12th Grade",
                "subtitle": "Execute & Ship Applications",
                "color": "amber",
                "academics": [
                    {
                        "title": "Maintain Your GPA",
                        "description": "Continue with challenging courses. Mid-year reports go to colleges. Consistency matters through the finish line.",
                        "icon": "BookOpen",
                        "tags": ["GPA", "Consistency"],
                    },
                    {
                        "title": "College-Level Chemistry Courses",
                        "description": "Physical chemistry, inorganic chemistry, or advanced organic — via dual enrollment. Show you're already performing at the college level.",
                        "icon": "Star",
                        "tags": ["Beyond AP"],
                    },
                ],
                "competitions": [
                    {
                        "title": "Final USNCO (March)",
                        "description": "Your last USNCO. A strong performance in 12th grade caps your competition profile beautifully.",
                        "icon": "FlaskConical",
                        "tags": ["USNCO", "Final"],
                    },
                    {
                        "title": "ISEF Finals (if qualified)",
                        "description": "May competition. Awards influence waitlist decisions and major scholarship awards.",
                        "icon": "Trophy",
                        "tags": ["ISEF"],
                    },
                ],
                "projects": [
                    {
                        "title": "Finalize Research Portfolio",
                        "description": "Complete any pending publications. Compile your research into a clear narrative: the questions you asked, methods you used, and what you discovered.",
                        "icon": "FileText",
                        "tags": ["Portfolio", "Research"],
                    },
                ],
                "summer": [
                    {
                        "title": "Early Decision / Early Action (Nov 1)",
                        "description": "Apply EA to MIT and Caltech (non-binding). Caltech especially values chemistry olympiad achievement. ED to your top choice if applicable.",
                        "icon": "Target",
                        "tags": ["Applications", "Critical"],
                    },
                    {
                        "title": "Regular Decision (Jan 1-5)",
                        "description": "Apply to Stanford, Harvard, UC Berkeley, Princeton, and other strong chemistry programs.",
                        "icon": "FileText",
                        "tags": ["Applications"],
                    },
                    {
                        "title": "Essays That Show Your Chemical Intuition",
                        "description": "Write about a reaction that surprised you, a mechanism you figured out, or how chemistry connects to real-world problems you care about.",
                        "icon": "Lightbulb",
                        "tags": ["Essays", "Critical"],
                    },
                ],
            },
        },
        "key_insights": [
            {
                "icon": "FlaskConical",
                "icon_color": "text-amber-500",
                "title": "USNCO Camp Is the Elite Credential",
                "description": "USNCO Study Camp (top 20 nationally) is the single most powerful chemistry competition credential. Selection means you're among the top 20 high school chemists in the country. Start preparing with Zumdahl and past USNCO exams.",
                "resources": ["Zumdahl Chemistry", "Clayden Organic Chemistry", "USNCO Past Exams"],
            },
            {
                "icon": "Microscope",
                "icon_color": "text-violet-500",
                "title": "Lab Skills Matter Enormously",
                "description": "Chemistry is a bench science. Admissions committees want to see you've done real lab work — synthesis, purification, characterization. The ability to work safely and effectively in a lab is what separates you from students who just ace exams.",
                "resources": [],
            },
            {
                "icon": "BookOpen",
                "icon_color": "text-blue-500",
                "title": "Pair Chemistry with Math and Physics",
                "description": "Physical chemistry is essentially applied physics and math. Quantum mechanics, thermodynamics, and spectroscopy require strong mathematical foundations. The best chemistry students are also excellent at math and physics.",
                "resources": ["Atkins Physical Chemistry"],
            },
            {
                "icon": "Leaf",
                "icon_color": "text-emerald-500",
                "title": "Green Chemistry and Materials Science Are Hot",
                "description": "Sustainable synthesis, biodegradable materials, and clean energy chemistry are high-growth research areas. Projects in these areas show awareness of chemistry's role in addressing global challenges.",
                "resources": [],
            },
            {
                "icon": "GraduationCap",
                "icon_color": "text-rose-500",
                "title": "Caltech Is the Chemistry Mecca",
                "description": "Caltech has arguably the strongest undergraduate chemistry program in the country. Their admissions heavily weights science olympiad performance and research experience. If chemistry is your passion, Caltech should be on your list.",
                "resources": [],
            },
        ],
        "ap_course_timeline": [
            {"grade": "9th", "courses": ["Honors Chemistry (or AP Chemistry)", "Advanced Math"]},
            {"grade": "10th", "courses": ["AP Chemistry (if not taken)", "AP Calculus BC", "AP Biology"]},
            {"grade": "11th", "courses": ["AP Physics C", "AP English Language", "AP US History", "Organic Chemistry (dual enrollment)"]},
            {"grade": "12th", "courses": ["Physical Chemistry (dual enrollment)", "Additional APs as available"]},
        ],
        "competition_milestones": [
            {
                "title": "USNCO Progression",
                "steps": ["Local Exam (9th)", "National Exam (10th)", "Honors/High Honors (11th)", "Study Camp Top 20 (11th-12th)"],
                "color": "amber",
            },
            {
                "title": "Science Olympiad",
                "steps": ["Chem Lab Event (9th)", "Regional Medals (10th)", "State Qualifier (11th)", "National Competitor (12th)"],
                "color": "blue",
            },
            {
                "title": "Science Fair → ISEF",
                "steps": ["School Fair (9th)", "Regional Fair (10th)", "State Fair (11th)", "ISEF Finals (11th-12th)"],
                "color": "emerald",
            },
            {
                "title": "Research Pipeline",
                "steps": ["Lab Exposure (9th)", "Research Assistant (10th)", "Independent Project (11th)", "Publication (11th-12th)"],
                "color": "violet",
            },
        ],
        "target_schools": [
            {"school": "Caltech", "program": "Chemistry", "strategy": "EA non-binding. Caltech is the gold standard for chemistry. Olympiad results and research depth matter most.", "deadline": "Nov 1 EA"},
            {"school": "MIT", "program": "Chemistry (Course 5)", "strategy": "EA non-binding. MIT Chemistry is excellent and interdisciplinary. Show breadth across chemistry subfields.", "deadline": "Nov 1 EA"},
            {"school": "Stanford", "program": "Chemistry", "strategy": "REA. Stanford Chemistry emphasizes innovation. Connect your research to real-world impact.", "deadline": "Nov 1 REA"},
            {"school": "Harvard", "program": "Chemistry & Chemical Biology", "strategy": "REA. Harvard CCB is world-class in organic and chemical biology. Strong research narrative essential.", "deadline": "Nov 1 REA"},
        ],
        "footer_note": "This plan is ambitious — that's intentional. Chemistry rewards depth: deep knowledge from USNCO preparation, deep lab skills from real research, and deep understanding from college-level coursework. Find the subfield of chemistry that excites you most and pursue it relentlessly.",
    },
}

# ──────────────────────────────────────────────────────────────────────
# 7. Physics
# ──────────────────────────────────────────────────────────────────────

PHYS_DATA = {
    "stem_area": "physics",
    "display_name": "Physics",
    "icon": "Atom",
    "description": "From USAPhO qualifier to Caltech Physics — a four-year roadmap for aspiring physicists targeting top research programs.",
    "content": {
        "grade_data": {
            "9th": {
                "label": "9th Grade",
                "subtitle": "Build the Mathematical Foundation",
                "color": "emerald",
                "academics": [
                    {
                        "title": "Honors Physics + Accelerated Math",
                        "description": "Physics lives on math. Push to the most advanced math track possible. If you can take AP Precalculus or start Calculus, do it.",
                        "icon": "BookOpen",
                        "tags": ["Math", "Critical"],
                    },
                    {
                        "title": "AP Computer Science A",
                        "description": "Computational physics is the third pillar alongside theory and experiment. Programming skills (Python especially) are essential for modern physics.",
                        "icon": "Code",
                        "tags": ["AP Exam", "Programming"],
                    },
                    {
                        "title": "Strong GPA Foundation",
                        "description": "Target unweighted 3.9+. Take honors in all available subjects. The physics programs at MIT, Caltech, and Princeton are extremely selective.",
                        "icon": "Star",
                        "tags": ["GPA", "All Subjects"],
                    },
                ],
                "competitions": [
                    {
                        "title": "AMC 10 / AMC 12",
                        "description": "Math competitions are critical for physics applicants. Physics is applied mathematics at its core. Aim for AIME qualification — math and physics are deeply intertwined.",
                        "icon": "Target",
                        "tags": ["AMC/AIME", "Critical"],
                    },
                    {
                        "title": "F=ma Exam Preparation",
                        "description": "Start preparing for the F=ma exam (first round of USAPhO). Study classical mechanics beyond your school curriculum. Halliday/Resnick is a good starting point.",
                        "icon": "Atom",
                        "tags": ["USAPhO", "Preparation"],
                    },
                    {
                        "title": "Science Olympiad — Physics Events",
                        "description": "Compete in physics events: Fermi Questions, Circuit Lab, and experimental physics events. These build both theoretical and practical physics skills.",
                        "icon": "Target",
                        "tags": ["Science Olympiad", "Physics"],
                    },
                ],
                "projects": [
                    {
                        "title": "Physics Simulations",
                        "description": "Write physics simulations in Python: projectile motion, orbital mechanics, wave interference. Visualize physics with matplotlib or pygame.",
                        "icon": "Code",
                        "tags": ["Simulation", "Programming"],
                    },
                    {
                        "title": "Home Physics Experiments",
                        "description": "Build a spectrometer, measure the speed of sound, or construct a Foucault pendulum. Hands-on experimentation develops physical intuition.",
                        "icon": "Atom",
                        "tags": ["Experiments", "Hands-On"],
                    },
                ],
                "summer": [
                    {
                        "title": "Physics Problem-Solving Training",
                        "description": "Work through Halliday/Resnick and Kleppner/Kolenkow (mechanics). Solve problems from past F=ma exams. Build the problem-solving muscle.",
                        "icon": "Atom",
                        "tags": ["F=ma", "Priority"],
                    },
                    {
                        "title": "Math Advancement",
                        "description": "Get ahead in math. If you haven't started calculus, begin self-study. For physics, calculus is the language — learn it as early as possible.",
                        "icon": "BookOpen",
                        "tags": ["Math", "Foundation"],
                    },
                    {
                        "title": "Astronomy / Physics Outreach",
                        "description": "Join a local astronomy club, volunteer at a planetarium, or attend physics lectures. Build community and exposure to the broader field.",
                        "icon": "GraduationCap",
                        "tags": ["Community", "Exploration"],
                    },
                ],
            },
            "10th": {
                "label": "10th Grade",
                "subtitle": "Master Mechanics & Compete",
                "color": "blue",
                "academics": [
                    {
                        "title": "AP Physics C: Mechanics",
                        "description": "Your flagship AP. This should be a deep exploration of Newtonian mechanics. Aim for a 5 while going well beyond the AP curriculum.",
                        "icon": "Atom",
                        "tags": ["AP Exam", "Critical"],
                    },
                    {
                        "title": "AP Calculus BC",
                        "description": "Multivariable calculus comes next. BC should be straightforward for a serious physics student. Focus on developing mathematical maturity.",
                        "icon": "BookOpen",
                        "tags": ["AP Exam", "Math"],
                    },
                    {
                        "title": "AP Chemistry",
                        "description": "Chemistry provides context for quantum mechanics and atomic physics. Thermodynamics in chemistry complements your physics understanding.",
                        "icon": "FlaskConical",
                        "tags": ["AP Exam", "Science"],
                    },
                ],
                "competitions": [
                    {
                        "title": "USAPhO Qualification",
                        "description": "Take the F=ma exam in January. Qualifying for USAPhO (top ~400) is a strong credential. Then aim for a top score on USAPhO to reach Training Camp.",
                        "icon": "Atom",
                        "tags": ["USAPhO", "Critical"],
                    },
                    {
                        "title": "AMC 12 / AIME",
                        "description": "Take AMC 12 and push for AIME qualification and a strong AIME score. USAMO qualification from the math side is highly complementary to physics.",
                        "icon": "Target",
                        "tags": ["AMC/AIME", "Math"],
                    },
                    {
                        "title": "Science Fair — Physics Research",
                        "description": "Start an ISEF-track physics project: optics, acoustics, electromagnetics, or computational physics. Choose something with measurable results.",
                        "icon": "FlaskConical",
                        "tags": ["ISEF Pipeline", "Research"],
                    },
                ],
                "projects": [
                    {
                        "title": "Computational Physics Project",
                        "description": "Simulate complex physical systems: N-body gravity, fluid dynamics, or quantum tunneling. Use Python with NumPy/SciPy or Julia.",
                        "icon": "Code",
                        "tags": ["Computation", "Advanced"],
                    },
                    {
                        "title": "Physics Research with a Professor",
                        "description": "Join a university physics lab. Astrophysics observations, condensed matter experiments, optics research — get exposure to real physics research.",
                        "icon": "Atom",
                        "tags": ["Research", "University"],
                    },
                ],
                "summer": [
                    {
                        "title": "Apply to SSP (Summer Science Program)",
                        "description": "SSP in Astrophysics or Biochemistry is among the most prestigious summer programs. Apply in February. Involves orbital mechanics calculations from telescope observations.",
                        "icon": "Star",
                        "tags": ["Elite Program", "SSP"],
                    },
                    {
                        "title": "Advanced Physics Self-Study",
                        "description": "Start studying E&M (Griffiths), special relativity, and modern physics. Go beyond the AP curriculum to build real physics understanding.",
                        "icon": "Atom",
                        "tags": ["Self-Study", "Advanced"],
                    },
                    {
                        "title": "Research Internship",
                        "description": "Spend the summer working in a physics lab. Data analysis, instrumentation, simulation — any hands-on research experience is valuable.",
                        "icon": "FlaskConical",
                        "tags": ["Research", "Priority"],
                    },
                ],
            },
            "11th": {
                "label": "11th Grade",
                "subtitle": "Peak Performance Year",
                "color": "violet",
                "academics": [
                    {
                        "title": "AP Physics C: E&M + College Physics",
                        "description": "Take AP Physics C: E&M and supplement with college-level physics (modern physics, quantum mechanics intro) via dual enrollment.",
                        "icon": "Atom",
                        "tags": ["AP Exam", "Critical"],
                    },
                    {
                        "title": "Multivariable Calculus + Linear Algebra + Differential Equations",
                        "description": "Via dual enrollment. All three are essential prerequisites for serious physics. Linear algebra is especially critical for quantum mechanics.",
                        "icon": "BookOpen",
                        "tags": ["Beyond AP", "Math"],
                    },
                    {
                        "title": "AP English Language + AP US History",
                        "description": "Humanities breadth matters. Feynman was a great communicator — admissions committees value physics students who can write and think broadly.",
                        "icon": "FileText",
                        "tags": ["AP Exam", "Breadth"],
                    },
                ],
                "competitions": [
                    {
                        "title": "USAPhO Training Camp",
                        "description": "The top ~20 USAPhO scorers are invited to Training Camp. This is the strongest physics competition credential. If not camp, a strong USAPhO score (Gold or Silver medal) is excellent.",
                        "icon": "Atom",
                        "tags": ["USAPhO", "Critical"],
                    },
                    {
                        "title": "ISEF Qualification",
                        "description": "Push your physics research through regional and state fairs. An ISEF finalist with a physics project stands out enormously.",
                        "icon": "Trophy",
                        "tags": ["ISEF", "Elite"],
                    },
                    {
                        "title": "AMC 12 / AIME / USAMO",
                        "description": "Continue pushing on math competitions. AIME + USAMO performance signals the mathematical maturity that physics programs value.",
                        "icon": "Target",
                        "tags": ["Math Competitions", "Complementary"],
                    },
                ],
                "projects": [
                    {
                        "title": "Research Publication",
                        "description": "Submit research to a journal or conference. Even arXiv preprints count. First-author or co-author papers demonstrate real research capability.",
                        "icon": "FlaskConical",
                        "tags": ["Publication", "Critical"],
                    },
                    {
                        "title": "Telescope Building or Advanced Experiment",
                        "description": "Build a telescope from optical components, construct a cloud chamber, or set up a Michelson interferometer. Physical experimentation skills matter.",
                        "icon": "Atom",
                        "tags": ["Experimental", "Portfolio"],
                    },
                ],
                "summer": [
                    {
                        "title": "RSI / SSP or Research Program",
                        "description": "RSI (MIT), SSP, or a dedicated physics research internship. This summer should produce your strongest research output.",
                        "icon": "Star",
                        "tags": ["Elite Program"],
                    },
                    {
                        "title": "College Application Prep",
                        "description": "Start essays. Research MIT Physics, Caltech Physics, Stanford Physics, Princeton Physics, Harvard Physics. Understand faculty research areas.",
                        "icon": "FileText",
                        "tags": ["Applications"],
                    },
                    {
                        "title": "Teacher Recommendations",
                        "description": "Ask your physics teacher (critical) and your math teacher. A research mentor recommendation as a supplemental letter is ideal.",
                        "icon": "GraduationCap",
                        "tags": ["Letters of Rec"],
                    },
                ],
            },
            "12th": {
                "label": "12th Grade",
                "subtitle": "Execute & Ship Applications",
                "color": "amber",
                "academics": [
                    {
                        "title": "Maintain Your GPA",
                        "description": "Keep up the rigor. Mid-year reports go to colleges. Continue with college-level physics and math courses.",
                        "icon": "BookOpen",
                        "tags": ["GPA", "Consistency"],
                    },
                    {
                        "title": "College-Level Physics Courses",
                        "description": "Quantum mechanics, classical mechanics (Lagrangian/Hamiltonian), or statistical mechanics via dual enrollment. Show you're already at the college level.",
                        "icon": "Star",
                        "tags": ["Beyond AP"],
                    },
                ],
                "competitions": [
                    {
                        "title": "Final F=ma + USAPhO (January-April)",
                        "description": "Your last shot at F=ma and USAPhO. A strong final-year performance caps your competition profile.",
                        "icon": "Atom",
                        "tags": ["USAPhO", "Final"],
                    },
                    {
                        "title": "ISEF Finals (if qualified)",
                        "description": "May competition. Awards influence waitlist decisions and scholarship offers.",
                        "icon": "Trophy",
                        "tags": ["ISEF"],
                    },
                ],
                "projects": [
                    {
                        "title": "Finalize Research Portfolio",
                        "description": "Complete pending publications. Compile your physics research narrative: the questions you explored, methods you used, and insights you gained.",
                        "icon": "FileText",
                        "tags": ["Portfolio", "Research"],
                    },
                ],
                "summer": [
                    {
                        "title": "Early Decision / Early Action (Nov 1)",
                        "description": "Apply EA to MIT and Caltech (both non-binding). Princeton EA is also non-binding and has an excellent physics program.",
                        "icon": "Target",
                        "tags": ["Applications", "Critical"],
                    },
                    {
                        "title": "Regular Decision (Jan 1-5)",
                        "description": "Apply to Stanford, Harvard, Chicago, Berkeley, and other strong physics programs. Consider liberal arts colleges like Harvey Mudd for physics.",
                        "icon": "FileText",
                        "tags": ["Applications"],
                    },
                    {
                        "title": "Essays That Show How You Think",
                        "description": "Write about a physics problem that captivated you. Describe how you think about the physical world. Convey the sense of wonder that drives you.",
                        "icon": "Lightbulb",
                        "tags": ["Essays", "Critical"],
                    },
                ],
            },
        },
        "key_insights": [
            {
                "icon": "Atom",
                "icon_color": "text-amber-500",
                "title": "USAPhO Camp is the Strongest Signal",
                "description": "USAPhO Training Camp (top ~20 nationally) is to physics what USACO Platinum is to CS. A Gold or Silver USAPhO medal is also very strong. The F=ma exam in January is the gateway — start preparing early.",
                "resources": ["Halliday/Resnick", "Kleppner Mechanics", "Griffiths E&M", "Past F=ma/USAPhO exams"],
            },
            {
                "icon": "Target",
                "icon_color": "text-violet-500",
                "title": "Math Competitions Complement Physics Perfectly",
                "description": "Physics is applied math. Strong AMC/AIME/USAMO performance signals the mathematical maturity that physics programs value. Many top physics admits also have strong math competition credentials.",
                "resources": ["AoPS", "AMC/AIME Past Problems"],
            },
            {
                "icon": "FlaskConical",
                "icon_color": "text-blue-500",
                "title": "Balance Theory and Experiment",
                "description": "The strongest physics applicants show both theoretical depth (competitions, self-study of advanced physics) and experimental skills (lab research, instrument building). Programs want students who can do both.",
                "resources": [],
            },
            {
                "icon": "Star",
                "icon_color": "text-emerald-500",
                "title": "SSP and RSI Are Transformative",
                "description": "The Summer Science Program (especially the astrophysics track) and RSI are the most valuable summer programs for physics applicants. SSP involves real orbital mechanics calculations from telescope data — it's rigorous and respected.",
                "resources": ["SSP", "RSI"],
            },
            {
                "icon": "GraduationCap",
                "icon_color": "text-rose-500",
                "title": "Caltech and Princeton Are Physics Paradises",
                "description": "Caltech (tiny undergraduate body, every student takes physics) and Princeton (Einstein's home) have arguable the strongest undergraduate physics programs. MIT is also outstanding. Tailor your applications to each program's unique culture.",
                "resources": [],
            },
        ],
        "ap_course_timeline": [
            {"grade": "9th", "courses": ["AP Computer Science A", "Honors Physics", "Accelerated Math"]},
            {"grade": "10th", "courses": ["AP Physics C: Mechanics", "AP Calculus BC", "AP Chemistry"]},
            {"grade": "11th", "courses": ["AP Physics C: E&M", "AP English Language", "AP US History", "Multivariable Calc + Linear Algebra (dual enrollment)"]},
            {"grade": "12th", "courses": ["Quantum Mechanics or Classical Mechanics (dual enrollment)", "Differential Equations (dual enrollment)"]},
        ],
        "competition_milestones": [
            {
                "title": "USAPhO Progression",
                "steps": ["F=ma Preparation (9th)", "F=ma Qualifier (10th)", "USAPhO Medal (11th)", "Training Camp (11th-12th)"],
                "color": "amber",
            },
            {
                "title": "Math Competitions",
                "steps": ["AMC 10/12 (9th)", "AIME Qualifier (10th)", "AIME 10+ (11th)", "USAMO Qualifier (11th-12th)"],
                "color": "blue",
            },
            {
                "title": "Science Fair → ISEF",
                "steps": ["School Fair (9th)", "Regional Fair (10th)", "State Fair (11th)", "ISEF Finals (11th-12th)"],
                "color": "emerald",
            },
            {
                "title": "Research Pipeline",
                "steps": ["Self-Study & Simulations (9th)", "Lab Assistant (10th)", "Independent Research (11th)", "Publication (11th-12th)"],
                "color": "violet",
            },
        ],
        "target_schools": [
            {"school": "MIT", "program": "Physics (Course 8)", "strategy": "EA non-binding. MIT Physics is legendary. Show both theoretical depth and experimental ability.", "deadline": "Nov 1 EA"},
            {"school": "Caltech", "program": "Physics", "strategy": "EA non-binding. Every Caltech student takes physics. Show deep physics passion and Olympiad results.", "deadline": "Nov 1 EA"},
            {"school": "Princeton", "program": "Physics", "strategy": "REA non-binding. Princeton Physics has unmatched theory faculty. Strong math and physics competition results valued.", "deadline": "Nov 1 REA"},
            {"school": "Stanford", "program": "Physics", "strategy": "REA. Stanford Physics emphasizes interdisciplinary research. Connect physics to broader impact.", "deadline": "Nov 1 REA"},
        ],
        "footer_note": "This plan is ambitious — that's intentional. Physics rewards deep thinkers who combine mathematical sophistication with physical intuition. You don't need to do everything — but a strong USAPhO result, meaningful research, and advanced math preparation form the winning combination.",
    },
}


# ──────────────────────────────────────────────────────────────────────
# Seed function
# ──────────────────────────────────────────────────────────────────────

ALL_AREAS = [CS_DATA, EE_DATA, ME_DATA, CE_DATA, BIO_DATA, CHEM_DATA, PHYS_DATA]


def seed():
    init_db()
    db = get_db()
    try:
        for area in ALL_AREAS:
            existing = (
                db.query(CounselingContent)
                .filter(CounselingContent.stem_area == area["stem_area"])
                .first()
            )
            if existing:
                existing.display_name = area["display_name"]
                existing.icon = area["icon"]
                existing.description = area["description"]
                existing.content = json.dumps(area["content"])
                print(f"  Updated: {area['display_name']}")
            else:
                db.add(
                    CounselingContent(
                        stem_area=area["stem_area"],
                        display_name=area["display_name"],
                        icon=area["icon"],
                        description=area["description"],
                        content=json.dumps(area["content"]),
                    )
                )
                print(f"  Created: {area['display_name']}")
        db.commit()
        print(f"\nSeeded {len(ALL_AREAS)} counseling areas.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
