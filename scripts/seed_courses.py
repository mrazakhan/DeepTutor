#!/usr/bin/env python3
"""Seed all 13 AP courses with units, topics, and learning objectives.

Usage:
    python scripts/seed_courses.py
"""

import json
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import hashlib

from src.database.engine import init_db, get_db
from src.database.models import Course, Unit, Topic, LearningObjective, User

# ──────────────────────────────────────────────────
# AP Course Definitions
# ──────────────────────────────────────────────────

AP_COURSES = [
    # ── Computer Science ──────────────────────────
    {
        "code": "AP_CSA",
        "name": "AP Computer Science A",
        "subject_area": "computer_science",
        "description": "Introductory college-level course in computer science using Java. Emphasizes object-oriented programming, data structures, and algorithm design. Updated for 2025-26 CED (4-unit structure, no inheritance).",
        "exam_format": json.dumps({
            "sections": [
                {"name": "Multiple Choice", "count": 42, "minutes": 90, "calculator": False, "choices": 4},
                {"name": "Free Response", "count": 4, "minutes": 90, "calculator": False}
            ],
            "frq_types": [
                "Methods and Control Structures",
                "Class Writing",
                "Data Analysis with ArrayList",
                "2D Array"
            ],
            "weight": {"mcq": 55, "frq": 45},
            "unit_weights": {
                "1": {"min": 15, "max": 25},
                "2": {"min": 25, "max": 35},
                "3": {"min": 10, "max": 18},
                "4": {"min": 30, "max": 40}
            },
            "score_cutoffs": {"5": 77, "4": 59, "3": 46, "2": 33},
            "reference": "Java Quick Reference",
            "digital": True,
            "platform": "Bluebook"
        }),
        "units": [
            # ── Unit 1: Using Objects and Methods (15-25%) ──
            {"number": 1, "title": "Using Objects and Methods", "topics": [
                {"num": "1.1", "title": "Why Programming? Why Java?"},
                {"num": "1.2", "title": "Variables and Primitive Data Types"},
                {"num": "1.3", "title": "Expressions and Assignment Statements"},
                {"num": "1.4", "title": "Assignment Statements and Input"},
                {"num": "1.5", "title": "Casting and Ranges of Variables"},
                {"num": "1.6", "title": "Compound Assignment Operators"},
                {"num": "1.7", "title": "Application Program Interface (API) and Libraries"},
                {"num": "1.8", "title": "Documentation With Comments"},
                {"num": "1.9", "title": "Calling a Void Method With Parameters"},
                {"num": "1.10", "title": "Calling a Non-Void Method"},
                {"num": "1.11", "title": "Using the Math Class"},
                {"num": "1.12", "title": "Objects: Instances of Classes"},
                {"num": "1.13", "title": "Creating and Storing Objects"},
                {"num": "1.14", "title": "Calling a Void Method"},
                {"num": "1.15", "title": "String Methods"},
            ]},
            # ── Unit 2: Selection and Iteration (25-35%) ──
            {"number": 2, "title": "Selection and Iteration", "topics": [
                {"num": "2.1", "title": "Boolean Expressions"},
                {"num": "2.2", "title": "if Statements"},
                {"num": "2.3", "title": "if-else Statements"},
                {"num": "2.4", "title": "else if Statements"},
                {"num": "2.5", "title": "Compound Boolean Expressions"},
                {"num": "2.6", "title": "Comparing Objects"},
                {"num": "2.7", "title": "while Loops"},
                {"num": "2.8", "title": "for Loops"},
                {"num": "2.9", "title": "Developing Algorithms Using Strings"},
                {"num": "2.10", "title": "Developing Algorithms"},
                {"num": "2.11", "title": "Nested Iteration"},
                {"num": "2.12", "title": "Informal Run-Time Analysis"},
            ]},
            # ── Unit 3: Class Creation (10-18%) ──
            {"number": 3, "title": "Class Creation", "topics": [
                {"num": "3.1", "title": "Abstraction and Program Design"},
                {"num": "3.2", "title": "Constructors"},
                {"num": "3.3", "title": "Instance Variables"},
                {"num": "3.4", "title": "Accessor Methods"},
                {"num": "3.5", "title": "Mutator Methods"},
                {"num": "3.6", "title": "Writing Methods"},
                {"num": "3.7", "title": "Static Variables and Methods"},
                {"num": "3.8", "title": "Scope and Access"},
                {"num": "3.9", "title": "The this Keyword"},
            ]},
            # ── Unit 4: Data Collections (30-40%) ──
            {"number": 4, "title": "Data Collections", "topics": [
                {"num": "4.1", "title": "Ethical and Social Implications of Computing"},
                {"num": "4.2", "title": "Array Creation and Access"},
                {"num": "4.3", "title": "Traversing Arrays"},
                {"num": "4.4", "title": "Enhanced for Loop for Arrays"},
                {"num": "4.5", "title": "Array Algorithms"},
                {"num": "4.6", "title": "Reading Text Files"},
                {"num": "4.7", "title": "ArrayList Creation and Access"},
                {"num": "4.8", "title": "Traversing ArrayLists"},
                {"num": "4.9", "title": "Enhanced for Loop for ArrayLists"},
                {"num": "4.10", "title": "ArrayList Algorithms"},
                {"num": "4.11", "title": "2D Array Creation and Access"},
                {"num": "4.12", "title": "Traversing 2D Arrays"},
                {"num": "4.13", "title": "2D Array Algorithms"},
                {"num": "4.14", "title": "Sequential Search"},
                {"num": "4.15", "title": "Selection Sort, Insertion Sort, and Mergesort"},
                {"num": "4.16", "title": "Recursion"},
                {"num": "4.17", "title": "Binary Search"},
            ]},
        ]
    },
    {
        "code": "AP_CSP",
        "name": "AP Computer Science Principles",
        "subject_area": "computer_science",
        "description": "Introduces students to the foundational concepts of computer science and explores the impact of computing and technology on society.",
        "exam_format": json.dumps({
            "sections": [
                {"name": "Multiple Choice", "count": 70, "minutes": 120, "calculator": False}
            ],
            "note": "Create Performance Task submitted separately"
        }),
        "units": [
            {"number": 1, "title": "Creative Development", "topics": [
                {"num": "1.1", "title": "Collaboration"},
                {"num": "1.2", "title": "Program Function and Purpose"},
                {"num": "1.3", "title": "Program Design and Development"},
                {"num": "1.4", "title": "Identifying and Correcting Errors"},
            ]},
            {"number": 2, "title": "Data", "topics": [
                {"num": "2.1", "title": "Binary Numbers"},
                {"num": "2.2", "title": "Data Compression"},
                {"num": "2.3", "title": "Extracting Information from Data"},
                {"num": "2.4", "title": "Using Programs with Data"},
            ]},
            {"number": 3, "title": "Algorithms and Programming", "topics": [
                {"num": "3.1", "title": "Variables and Assignments"},
                {"num": "3.2", "title": "Data Abstraction"},
                {"num": "3.3", "title": "Mathematical Expressions"},
                {"num": "3.4", "title": "Strings"},
                {"num": "3.5", "title": "Boolean Expressions"},
                {"num": "3.6", "title": "Conditionals"},
                {"num": "3.7", "title": "Nested Conditionals"},
                {"num": "3.8", "title": "Iteration"},
                {"num": "3.9", "title": "Developing Algorithms"},
                {"num": "3.10", "title": "Lists"},
                {"num": "3.11", "title": "Binary Search"},
                {"num": "3.12", "title": "Calling Procedures"},
                {"num": "3.13", "title": "Developing Procedures"},
                {"num": "3.14", "title": "Libraries"},
                {"num": "3.15", "title": "Random Values"},
                {"num": "3.16", "title": "Simulations"},
                {"num": "3.17", "title": "Algorithmic Efficiency"},
                {"num": "3.18", "title": "Undecidable Problems"},
            ]},
            {"number": 4, "title": "Computing Systems and Networks", "topics": [
                {"num": "4.1", "title": "The Internet"},
                {"num": "4.2", "title": "Fault Tolerance"},
                {"num": "4.3", "title": "Parallel and Distributed Computing"},
            ]},
            {"number": 5, "title": "Impact of Computing", "topics": [
                {"num": "5.1", "title": "Beneficial and Harmful Effects"},
                {"num": "5.2", "title": "Digital Divide"},
                {"num": "5.3", "title": "Computing Bias"},
                {"num": "5.4", "title": "Crowdsourcing"},
                {"num": "5.5", "title": "Legal and Ethical Concerns"},
                {"num": "5.6", "title": "Safe Computing"},
            ]},
        ]
    },

    # ── Mathematics ───────────────────────────────
    {
        "code": "AP_CALC_AB",
        "name": "AP Calculus AB",
        "subject_area": "math",
        "description": "Covers limits, derivatives, integrals, and the Fundamental Theorem of Calculus. Equivalent to a first-semester college calculus course.",
        "exam_format": json.dumps({
            "sections": [
                {"name": "MCQ Part A", "count": 30, "minutes": 60, "calculator": False},
                {"name": "MCQ Part B", "count": 15, "minutes": 45, "calculator": True},
                {"name": "FRQ Part A", "count": 2, "minutes": 30, "calculator": True},
                {"name": "FRQ Part B", "count": 4, "minutes": 60, "calculator": False}
            ]
        }),
        "units": [
            {"number": 1, "title": "Limits and Continuity", "topics": [
                {"num": "1.1", "title": "Introducing Calculus: Can Change Occur at an Instant?"},
                {"num": "1.2", "title": "Defining Limits and Using Limit Notation"},
                {"num": "1.3", "title": "Estimating Limit Values from Graphs"},
                {"num": "1.4", "title": "Estimating Limit Values from Tables"},
                {"num": "1.5", "title": "Determining Limits Using Algebraic Properties"},
                {"num": "1.6", "title": "Determining Limits Using Algebraic Manipulation"},
                {"num": "1.7", "title": "Selecting Procedures for Determining Limits"},
                {"num": "1.8", "title": "Determining Limits Using the Squeeze Theorem"},
                {"num": "1.9", "title": "Connecting Multiple Representations of Limits"},
                {"num": "1.10", "title": "Exploring Types of Discontinuities"},
                {"num": "1.11", "title": "Defining Continuity at a Point"},
                {"num": "1.12", "title": "Confirming Continuity over an Interval"},
                {"num": "1.13", "title": "Removing Discontinuities"},
                {"num": "1.14", "title": "Connecting Infinite Limits and Vertical Asymptotes"},
                {"num": "1.15", "title": "Connecting Limits at Infinity and Horizontal Asymptotes"},
                {"num": "1.16", "title": "Working with the Intermediate Value Theorem"},
            ]},
            {"number": 2, "title": "Differentiation: Definition and Fundamental Properties", "topics": [
                {"num": "2.1", "title": "Defining Average and Instantaneous Rates of Change"},
                {"num": "2.2", "title": "Defining the Derivative of a Function"},
                {"num": "2.3", "title": "Estimating Derivatives of a Function at a Point"},
                {"num": "2.4", "title": "Connecting Differentiability and Continuity"},
                {"num": "2.5", "title": "Applying the Power Rule"},
                {"num": "2.6", "title": "Derivative Rules: Constant, Sum, Difference, Constant Multiple"},
                {"num": "2.7", "title": "Derivatives of cos x, sin x, e^x, and ln x"},
                {"num": "2.8", "title": "The Product Rule"},
                {"num": "2.9", "title": "The Quotient Rule"},
                {"num": "2.10", "title": "Finding the Derivatives of Tangent, Cotangent, Secant, Cosecant"},
            ]},
            {"number": 3, "title": "Differentiation: Composite, Implicit, and Inverse Functions", "topics": [
                {"num": "3.1", "title": "The Chain Rule"},
                {"num": "3.2", "title": "Implicit Differentiation"},
                {"num": "3.3", "title": "Differentiating Inverse Functions"},
                {"num": "3.4", "title": "Differentiating Inverse Trigonometric Functions"},
                {"num": "3.5", "title": "Selecting Procedures for Calculating Derivatives"},
                {"num": "3.6", "title": "Calculating Higher-Order Derivatives"},
            ]},
            {"number": 4, "title": "Contextual Applications of Differentiation", "topics": [
                {"num": "4.1", "title": "Interpreting the Meaning of the Derivative in Context"},
                {"num": "4.2", "title": "Straight-Line Motion: Connecting Position, Velocity, Acceleration"},
                {"num": "4.3", "title": "Rates of Change in Applied Contexts Other Than Motion"},
                {"num": "4.4", "title": "Introduction to Related Rates"},
                {"num": "4.5", "title": "Solving Related Rates Problems"},
                {"num": "4.6", "title": "Approximating Values of a Function Using Local Linearity"},
                {"num": "4.7", "title": "Using L'Hopital's Rule for Determining Limits"},
            ]},
            {"number": 5, "title": "Analytical Applications of Differentiation", "topics": [
                {"num": "5.1", "title": "Using the Mean Value Theorem"},
                {"num": "5.2", "title": "Extreme Value Theorem, Global vs Local Extrema"},
                {"num": "5.3", "title": "Determining Intervals on Which a Function is Increasing or Decreasing"},
                {"num": "5.4", "title": "Using the First Derivative Test to Determine Relative Extrema"},
                {"num": "5.5", "title": "Using the Candidates Test to Determine Absolute Extrema"},
                {"num": "5.6", "title": "Determining Concavity of Functions"},
                {"num": "5.7", "title": "Using the Second Derivative Test"},
                {"num": "5.8", "title": "Sketching Graphs of Functions and Their Derivatives"},
                {"num": "5.9", "title": "Connecting a Function, Its First Derivative, Its Second Derivative"},
                {"num": "5.10", "title": "Introduction to Optimization Problems"},
                {"num": "5.11", "title": "Solving Optimization Problems"},
                {"num": "5.12", "title": "Exploring Behaviors of Implicit Relations"},
            ]},
            {"number": 6, "title": "Integration and Accumulation of Change", "topics": [
                {"num": "6.1", "title": "Exploring Accumulations of Change"},
                {"num": "6.2", "title": "Approximating Areas with Riemann Sums"},
                {"num": "6.3", "title": "Riemann Sums, Summation Notation, and Definite Integral Notation"},
                {"num": "6.4", "title": "The Fundamental Theorem of Calculus and Accumulation Functions"},
                {"num": "6.5", "title": "Interpreting the Behavior of Accumulation Functions"},
                {"num": "6.6", "title": "Applying Properties of Definite Integrals"},
                {"num": "6.7", "title": "The Fundamental Theorem of Calculus and Definite Integrals"},
                {"num": "6.8", "title": "Finding Antiderivatives and Indefinite Integrals: Basic Rules"},
                {"num": "6.9", "title": "Integrating Using Substitution"},
                {"num": "6.10", "title": "Integrating Functions Using Long Division and Completing the Square"},
                {"num": "6.11", "title": "Integrating Using Integration by Parts (BC only, optional for AB)"},
            ]},
            {"number": 7, "title": "Differential Equations", "topics": [
                {"num": "7.1", "title": "Modeling Situations with Differential Equations"},
                {"num": "7.2", "title": "Verifying Solutions for Differential Equations"},
                {"num": "7.3", "title": "Sketching Slope Fields"},
                {"num": "7.4", "title": "Reasoning Using Slope Fields"},
                {"num": "7.5", "title": "Approximating Solutions Using Euler's Method (BC only)"},
                {"num": "7.6", "title": "Finding General Solutions Using Separation of Variables"},
                {"num": "7.7", "title": "Finding Particular Solutions Using Initial Conditions"},
                {"num": "7.8", "title": "Exponential Models with Differential Equations"},
            ]},
            {"number": 8, "title": "Applications of Integration", "topics": [
                {"num": "8.1", "title": "Finding the Average Value of a Function on an Interval"},
                {"num": "8.2", "title": "Connecting Position, Velocity, and Acceleration Using Integrals"},
                {"num": "8.3", "title": "Using Accumulation Functions and Definite Integrals in Applied Contexts"},
                {"num": "8.4", "title": "Finding the Area Between Curves Expressed as Functions of x"},
                {"num": "8.5", "title": "Finding the Area Between Curves Expressed as Functions of y"},
                {"num": "8.6", "title": "Finding the Area Between Curves That Intersect at More Than Two Points"},
                {"num": "8.7", "title": "Volumes with Cross Sections: Squares and Rectangles"},
                {"num": "8.8", "title": "Volumes with Cross Sections: Triangles and Semicircles"},
                {"num": "8.9", "title": "Volume with Disc Method: Revolving Around the x- or y-Axis"},
                {"num": "8.10", "title": "Volume with Disc Method: Revolving Around Other Axes"},
                {"num": "8.11", "title": "Volume with Washer Method: Revolving Around the x- or y-Axis"},
                {"num": "8.12", "title": "Volume with Washer Method: Revolving Around Other Axes"},
            ]},
        ]
    },
    {
        "code": "AP_CALC_BC",
        "name": "AP Calculus BC",
        "subject_area": "math",
        "description": "Covers all AB topics plus parametric, polar, vector functions, and infinite series. Equivalent to first and second semester college calculus.",
        "exam_format": json.dumps({
            "sections": [
                {"name": "MCQ Part A", "count": 30, "minutes": 60, "calculator": False},
                {"name": "MCQ Part B", "count": 15, "minutes": 45, "calculator": True},
                {"name": "FRQ Part A", "count": 2, "minutes": 30, "calculator": True},
                {"name": "FRQ Part B", "count": 4, "minutes": 60, "calculator": False}
            ]
        }),
        "units": [
            {"number": 1, "title": "Limits and Continuity", "topics": [
                {"num": "1.1", "title": "Limits and Continuity (same as AB Unit 1)"},
            ]},
            {"number": 2, "title": "Differentiation: Definition and Properties", "topics": [
                {"num": "2.1", "title": "Differentiation Fundamentals (same as AB Unit 2)"},
            ]},
            {"number": 3, "title": "Differentiation: Composite, Implicit, Inverse", "topics": [
                {"num": "3.1", "title": "Chain Rule, Implicit, Inverse (same as AB Unit 3)"},
            ]},
            {"number": 4, "title": "Contextual Applications of Differentiation", "topics": [
                {"num": "4.1", "title": "Applied Differentiation (same as AB Unit 4)"},
            ]},
            {"number": 5, "title": "Analytical Applications of Differentiation", "topics": [
                {"num": "5.1", "title": "Analytical Differentiation (same as AB Unit 5)"},
            ]},
            {"number": 6, "title": "Integration and Accumulation of Change", "topics": [
                {"num": "6.1", "title": "Integration Fundamentals (includes AB Unit 6 + Integration by Parts)"},
                {"num": "6.2", "title": "Integration Using Partial Fractions"},
                {"num": "6.3", "title": "Evaluating Improper Integrals"},
            ]},
            {"number": 7, "title": "Differential Equations", "topics": [
                {"num": "7.1", "title": "Differential Equations (includes AB Unit 7 + Euler's Method)"},
                {"num": "7.2", "title": "Logistic Models with Differential Equations"},
            ]},
            {"number": 8, "title": "Applications of Integration", "topics": [
                {"num": "8.1", "title": "Applications (same as AB Unit 8)"},
                {"num": "8.2", "title": "Arc Length and Distance Traveled"},
            ]},
            {"number": 9, "title": "Parametric Equations, Polar Coordinates, and Vector-Valued Functions", "topics": [
                {"num": "9.1", "title": "Defining and Differentiating Parametric Equations"},
                {"num": "9.2", "title": "Second Derivatives of Parametric Equations"},
                {"num": "9.3", "title": "Finding Arc Lengths of Curves Given by Parametric Equations"},
                {"num": "9.4", "title": "Defining and Differentiating Vector-Valued Functions"},
                {"num": "9.5", "title": "Integrating Vector-Valued Functions"},
                {"num": "9.6", "title": "Solving Motion Problems Using Parametric and Vector-Valued Functions"},
                {"num": "9.7", "title": "Defining Polar Coordinates and Differentiating in Polar Form"},
                {"num": "9.8", "title": "Finding the Area of a Polar Region"},
                {"num": "9.9", "title": "Finding the Area of the Region Bounded by Two Polar Curves"},
            ]},
            {"number": 10, "title": "Infinite Sequences and Series", "topics": [
                {"num": "10.1", "title": "Defining Convergent and Divergent Infinite Series"},
                {"num": "10.2", "title": "Working with Geometric Series"},
                {"num": "10.3", "title": "The nth Term Test for Divergence"},
                {"num": "10.4", "title": "Integral Test for Convergence"},
                {"num": "10.5", "title": "Harmonic Series and p-Series"},
                {"num": "10.6", "title": "Comparison Tests for Convergence"},
                {"num": "10.7", "title": "Alternating Series Test for Convergence"},
                {"num": "10.8", "title": "Ratio Test for Convergence"},
                {"num": "10.9", "title": "Determining Absolute or Conditional Convergence"},
                {"num": "10.10", "title": "Alternating Series Error Bound"},
                {"num": "10.11", "title": "Finding Taylor Polynomial Approximations of Functions"},
                {"num": "10.12", "title": "Lagrange Error Bound"},
                {"num": "10.13", "title": "Radius and Interval of Convergence of Power Series"},
                {"num": "10.14", "title": "Finding Taylor or Maclaurin Series for a Function"},
                {"num": "10.15", "title": "Representing Functions as Power Series"},
            ]},
        ]
    },
    {
        "code": "AP_STATS",
        "name": "AP Statistics",
        "subject_area": "math",
        "description": "Introduces students to major concepts and tools for collecting, analyzing, and drawing conclusions from data.",
        "exam_format": json.dumps({
            "sections": [
                {"name": "Multiple Choice", "count": 40, "minutes": 90, "calculator": True},
                {"name": "Free Response", "count": 6, "minutes": 90, "calculator": True}
            ]
        }),
        "units": [
            {"number": 1, "title": "Exploring One-Variable Data", "topics": [
                {"num": "1.1", "title": "Introducing Statistics: What Can We Learn from Data?"},
                {"num": "1.2", "title": "The Language of Variation: Variables"},
                {"num": "1.3", "title": "Representing a Categorical Variable with Tables"},
                {"num": "1.4", "title": "Representing a Categorical Variable with Graphs"},
                {"num": "1.5", "title": "Representing a Quantitative Variable with Graphs"},
                {"num": "1.6", "title": "Describing the Distribution of a Quantitative Variable"},
                {"num": "1.7", "title": "Summary Statistics"},
                {"num": "1.8", "title": "Graphical Representations of Summary Statistics"},
                {"num": "1.9", "title": "Comparing Distributions of a Quantitative Variable"},
                {"num": "1.10", "title": "The Normal Distribution"},
            ]},
            {"number": 2, "title": "Exploring Two-Variable Data", "topics": [
                {"num": "2.1", "title": "Introducing Statistics: Are Variables Related?"},
                {"num": "2.2", "title": "Representing Two Categorical Variables"},
                {"num": "2.3", "title": "Statistics for Two Categorical Variables"},
                {"num": "2.4", "title": "Representing the Relationship Between Two Quantitative Variables"},
                {"num": "2.5", "title": "Correlation"},
                {"num": "2.6", "title": "Linear Regression Models"},
                {"num": "2.7", "title": "Residuals"},
                {"num": "2.8", "title": "Least Squares Regression"},
                {"num": "2.9", "title": "Analyzing Departures from Linearity"},
            ]},
            {"number": 3, "title": "Collecting Data", "topics": [
                {"num": "3.1", "title": "Introducing Statistics: Do the Data We Collected Tell the Truth?"},
                {"num": "3.2", "title": "Introduction to Planning a Study"},
                {"num": "3.3", "title": "Random Sampling and Data Collection"},
                {"num": "3.4", "title": "Potential Problems with Sampling"},
                {"num": "3.5", "title": "Introduction to Experimental Design"},
                {"num": "3.6", "title": "Selecting an Experimental Design"},
            ]},
            {"number": 4, "title": "Probability, Random Variables, and Probability Distributions", "topics": [
                {"num": "4.1", "title": "Introducing Statistics: Random and Non-Random Patterns?"},
                {"num": "4.2", "title": "Estimating Probabilities Using Simulation"},
                {"num": "4.3", "title": "Introduction to Probability"},
                {"num": "4.4", "title": "Mutually Exclusive Events"},
                {"num": "4.5", "title": "Conditional Probability"},
                {"num": "4.6", "title": "Independent Events and Unions of Events"},
                {"num": "4.7", "title": "Introduction to Random Variables and Probability Distributions"},
                {"num": "4.8", "title": "Mean and Standard Deviation of Random Variables"},
                {"num": "4.9", "title": "Combining Random Variables"},
                {"num": "4.10", "title": "Introduction to the Binomial Distribution"},
                {"num": "4.11", "title": "Parameters for a Binomial Distribution"},
                {"num": "4.12", "title": "The Geometric Distribution"},
            ]},
            {"number": 5, "title": "Sampling Distributions", "topics": [
                {"num": "5.1", "title": "Introducing Statistics: Why Is My Sample Not Like Yours?"},
                {"num": "5.2", "title": "The Normal Distribution, Revisited"},
                {"num": "5.3", "title": "The Central Limit Theorem"},
                {"num": "5.4", "title": "Biased and Unbiased Point Estimates"},
                {"num": "5.5", "title": "Sampling Distributions for Sample Proportions"},
                {"num": "5.6", "title": "Sampling Distributions for Sample Means"},
                {"num": "5.7", "title": "Sampling Distributions for Differences in Sample Proportions"},
                {"num": "5.8", "title": "Sampling Distributions for Differences in Sample Means"},
            ]},
            {"number": 6, "title": "Inference for Categorical Data: Proportions", "topics": [
                {"num": "6.1", "title": "Introducing Statistics: Why Be Normal?"},
                {"num": "6.2", "title": "Constructing a Confidence Interval for a Population Proportion"},
                {"num": "6.3", "title": "Justifying a Claim Based on a Confidence Interval for a Population Proportion"},
                {"num": "6.4", "title": "Setting Up a Test for a Population Proportion"},
                {"num": "6.5", "title": "Interpreting p-Values"},
                {"num": "6.6", "title": "Concluding a Test for a Population Proportion"},
                {"num": "6.7", "title": "Potential Errors When Performing Tests"},
                {"num": "6.8", "title": "Confidence Intervals for the Difference of Two Proportions"},
                {"num": "6.9", "title": "Justifying a Claim Based on a Confidence Interval for a Difference"},
                {"num": "6.10", "title": "Setting Up a Test for the Difference of Two Proportions"},
                {"num": "6.11", "title": "Carrying Out and Interpreting a Test for the Difference of Two Proportions"},
            ]},
            {"number": 7, "title": "Inference for Quantitative Data: Means", "topics": [
                {"num": "7.1", "title": "Introducing Statistics: Should I Worry About Error?"},
                {"num": "7.2", "title": "Constructing a Confidence Interval for a Population Mean"},
                {"num": "7.3", "title": "Justifying a Claim Based on a Confidence Interval for a Population Mean"},
                {"num": "7.4", "title": "Setting Up a Test for a Population Mean"},
                {"num": "7.5", "title": "Carrying Out a Test for a Population Mean"},
                {"num": "7.6", "title": "Confidence Intervals for the Difference of Two Population Means"},
                {"num": "7.7", "title": "Justifying a Claim About the Difference of Two Means Based on a CI"},
                {"num": "7.8", "title": "Setting Up a Test for the Difference of Two Population Means"},
                {"num": "7.9", "title": "Carrying Out a Test for the Difference of Two Population Means"},
            ]},
            {"number": 8, "title": "Inference for Categorical Data: Chi-Square", "topics": [
                {"num": "8.1", "title": "Introducing Statistics: Could It Just Be by Chance?"},
                {"num": "8.2", "title": "Setting Up a Chi-Square Goodness of Fit Test"},
                {"num": "8.3", "title": "Carrying Out a Chi-Square Test for Goodness of Fit"},
                {"num": "8.4", "title": "Expected Counts in Two-Way Tables"},
                {"num": "8.5", "title": "Setting Up a Chi-Square Test for Homogeneity or Independence"},
                {"num": "8.6", "title": "Carrying Out a Chi-Square Test for Homogeneity or Independence"},
            ]},
            {"number": 9, "title": "Inference for Quantitative Data: Slopes", "topics": [
                {"num": "9.1", "title": "Introducing Statistics: Do Those Points Predict Mine?"},
                {"num": "9.2", "title": "Confidence Intervals for the Slope of a Regression Model"},
                {"num": "9.3", "title": "Justifying a Claim About the Slope of a Regression Model"},
                {"num": "9.4", "title": "Setting Up a Test for the Slope of a Regression Model"},
                {"num": "9.5", "title": "Carrying Out a Test for the Slope of a Regression Model"},
            ]},
        ]
    },
    {
        "code": "AP_PRECALC",
        "name": "AP Precalculus",
        "subject_area": "math",
        "description": "Provides a foundation for future calculus courses. Explores polynomial, rational, exponential, logarithmic, and trigonometric functions.",
        "exam_format": json.dumps({
            "sections": [
                {"name": "MCQ Part A", "count": 28, "minutes": 80, "calculator": False},
                {"name": "MCQ Part B", "count": 12, "minutes": 40, "calculator": True}
            ]
        }),
        "units": [
            {"number": 1, "title": "Polynomial and Rational Functions", "topics": [
                {"num": "1.1", "title": "Change in Tandem"},
                {"num": "1.2", "title": "Rates of Change"},
                {"num": "1.3", "title": "Rates of Change in Linear and Quadratic Functions"},
                {"num": "1.4", "title": "Polynomial Functions and Rates of Change"},
                {"num": "1.5", "title": "Polynomial Functions and Complex Zeros"},
                {"num": "1.6", "title": "Polynomial Functions and End Behavior"},
                {"num": "1.7", "title": "Rational Functions and End Behavior"},
                {"num": "1.8", "title": "Rational Functions and Zeros"},
                {"num": "1.9", "title": "Rational Functions and Vertical Asymptotes"},
                {"num": "1.10", "title": "Rational Functions and Holes"},
                {"num": "1.11", "title": "Equivalent Representations of Polynomial and Rational Expressions"},
                {"num": "1.12", "title": "Transformations of Functions"},
                {"num": "1.13", "title": "Function Model Selection and Assumption Articulation"},
                {"num": "1.14", "title": "Function Model Construction and Application"},
            ]},
            {"number": 2, "title": "Exponential and Logarithmic Functions", "topics": [
                {"num": "2.1", "title": "Change in Arithmetic and Geometric Sequences"},
                {"num": "2.2", "title": "Change in Linear and Exponential Functions"},
                {"num": "2.3", "title": "Exponential Functions"},
                {"num": "2.4", "title": "Exponential Function Manipulation"},
                {"num": "2.5", "title": "Exponential Function Context and Data Modeling"},
                {"num": "2.6", "title": "Competing Function Model Validation"},
                {"num": "2.7", "title": "Composition of Functions"},
                {"num": "2.8", "title": "Inverse Functions"},
                {"num": "2.9", "title": "Logarithmic Expressions"},
                {"num": "2.10", "title": "Inverses of Exponential Functions"},
                {"num": "2.11", "title": "Logarithmic Functions"},
                {"num": "2.12", "title": "Logarithmic Function Manipulation"},
                {"num": "2.13", "title": "Exponential and Logarithmic Equations and Inequalities"},
                {"num": "2.14", "title": "Logarithmic Function Context and Data Modeling"},
                {"num": "2.15", "title": "Semi-Log Plots"},
            ]},
            {"number": 3, "title": "Trigonometric and Polar Functions", "topics": [
                {"num": "3.1", "title": "Periodic Phenomena"},
                {"num": "3.2", "title": "Sine, Cosine, and Tangent"},
                {"num": "3.3", "title": "Sine and Cosine Function Values"},
                {"num": "3.4", "title": "Sine and Cosine Function Graphs"},
                {"num": "3.5", "title": "Sinusoidal Functions"},
                {"num": "3.6", "title": "Sinusoidal Function Transformations"},
                {"num": "3.7", "title": "Sinusoidal Function Context and Data Modeling"},
                {"num": "3.8", "title": "The Tangent Function"},
                {"num": "3.9", "title": "Inverse Trigonometric Functions"},
                {"num": "3.10", "title": "Trigonometric Equations and Inequalities"},
                {"num": "3.11", "title": "The Secant, Cosecant, and Cotangent Functions"},
                {"num": "3.12", "title": "Equivalent Representations of Trigonometric Functions"},
                {"num": "3.13", "title": "Trigonometry and Polar Coordinates"},
                {"num": "3.14", "title": "Polar Function Graphs"},
                {"num": "3.15", "title": "Rates of Change in Polar Functions"},
            ]},
            {"number": 4, "title": "Functions Involving Parameters, Vectors, and Matrices", "topics": [
                {"num": "4.1", "title": "Parametric Functions"},
                {"num": "4.2", "title": "Parametric Functions Modeling Planar Motion"},
                {"num": "4.3", "title": "Parametric Functions and Rates of Change"},
                {"num": "4.4", "title": "Parametrically Defined Circles and Lines"},
                {"num": "4.5", "title": "Implicitly Defined Functions"},
                {"num": "4.6", "title": "Conic Sections"},
                {"num": "4.7", "title": "Vectors"},
                {"num": "4.8", "title": "Vector-Valued Functions"},
                {"num": "4.9", "title": "Matrices"},
            ]},
        ]
    },

    # ── Science ───────────────────────────────────
    {
        "code": "AP_BIO",
        "name": "AP Biology",
        "subject_area": "science",
        "description": "College-level biology course covering evolution, cellular processes, genetics, and ecology through inquiry-based labs.",
        "exam_format": json.dumps({
            "sections": [
                {"name": "Multiple Choice", "count": 60, "minutes": 90, "calculator": False},
                {"name": "Free Response", "count": 6, "minutes": 90, "calculator": False}
            ]
        }),
        "units": [
            {"number": 1, "title": "Chemistry of Life", "topics": [
                {"num": "1.1", "title": "Structure of Water and Hydrogen Bonding"},
                {"num": "1.2", "title": "Elements of Life"},
                {"num": "1.3", "title": "Introduction to Biological Macromolecules"},
                {"num": "1.4", "title": "Properties of Biological Macromolecules"},
                {"num": "1.5", "title": "Structure and Function of Biological Macromolecules"},
                {"num": "1.6", "title": "Nucleic Acids"},
            ]},
            {"number": 2, "title": "Cell Structure and Function", "topics": [
                {"num": "2.1", "title": "Cell Structure: Subcellular Components"},
                {"num": "2.2", "title": "Cell Structure and Function"},
                {"num": "2.3", "title": "Cell Size"},
                {"num": "2.4", "title": "Plasma Membranes"},
                {"num": "2.5", "title": "Membrane Transport"},
                {"num": "2.6", "title": "Facilitated Diffusion"},
                {"num": "2.7", "title": "Tonicity and Osmoregulation"},
                {"num": "2.8", "title": "Mechanisms of Transport"},
                {"num": "2.9", "title": "Cell Compartmentalization"},
                {"num": "2.10", "title": "Origins of Cell Compartmentalization"},
            ]},
            {"number": 3, "title": "Cellular Energetics", "topics": [
                {"num": "3.1", "title": "Enzyme Structure"},
                {"num": "3.2", "title": "Enzyme Catalysis"},
                {"num": "3.3", "title": "Environmental Impacts on Enzyme Function"},
                {"num": "3.4", "title": "Cellular Energy"},
                {"num": "3.5", "title": "Photosynthesis"},
                {"num": "3.6", "title": "Cellular Respiration"},
                {"num": "3.7", "title": "Fitness"},
            ]},
            {"number": 4, "title": "Cell Communication and Cell Cycle", "topics": [
                {"num": "4.1", "title": "Cell Communication"},
                {"num": "4.2", "title": "Introduction to Signal Transduction"},
                {"num": "4.3", "title": "Signal Transduction"},
                {"num": "4.4", "title": "Changes in Signal Transduction Pathways"},
                {"num": "4.5", "title": "Feedback"},
                {"num": "4.6", "title": "Cell Cycle"},
                {"num": "4.7", "title": "Regulation of Cell Cycle"},
            ]},
            {"number": 5, "title": "Heredity", "topics": [
                {"num": "5.1", "title": "Meiosis"},
                {"num": "5.2", "title": "Meiosis and Genetic Diversity"},
                {"num": "5.3", "title": "Mendelian Genetics"},
                {"num": "5.4", "title": "Non-Mendelian Genetics"},
            ]},
            {"number": 6, "title": "Gene Expression and Regulation", "topics": [
                {"num": "6.1", "title": "DNA and RNA Structure"},
                {"num": "6.2", "title": "Replication"},
                {"num": "6.3", "title": "Transcription and RNA Processing"},
                {"num": "6.4", "title": "Translation"},
                {"num": "6.5", "title": "Regulation of Gene Expression"},
                {"num": "6.6", "title": "Gene Expression and Cell Specialization"},
                {"num": "6.7", "title": "Mutations"},
                {"num": "6.8", "title": "Biotechnology"},
            ]},
            {"number": 7, "title": "Natural Selection", "topics": [
                {"num": "7.1", "title": "Introduction to Natural Selection"},
                {"num": "7.2", "title": "Natural Selection"},
                {"num": "7.3", "title": "Artificial Selection"},
                {"num": "7.4", "title": "Population Genetics"},
                {"num": "7.5", "title": "Hardy-Weinberg Equilibrium"},
                {"num": "7.6", "title": "Evidence of Evolution"},
                {"num": "7.7", "title": "Common Ancestry"},
                {"num": "7.8", "title": "Continuing Evolution"},
                {"num": "7.9", "title": "Phylogeny"},
                {"num": "7.10", "title": "Speciation"},
                {"num": "7.11", "title": "Extinction"},
                {"num": "7.12", "title": "Variations in Populations"},
                {"num": "7.13", "title": "Origin of Life on Earth"},
            ]},
            {"number": 8, "title": "Ecology", "topics": [
                {"num": "8.1", "title": "Responses to the Environment"},
                {"num": "8.2", "title": "Energy Flow Through Ecosystems"},
                {"num": "8.3", "title": "Population Ecology"},
                {"num": "8.4", "title": "Effect of Density of Populations"},
                {"num": "8.5", "title": "Community Ecology"},
                {"num": "8.6", "title": "Biodiversity"},
                {"num": "8.7", "title": "Disruptions to Ecosystems"},
            ]},
        ]
    },
    {
        "code": "AP_CHEM",
        "name": "AP Chemistry",
        "subject_area": "science",
        "description": "College-level chemistry covering atomic structure, bonding, reactions, kinetics, thermodynamics, and equilibrium.",
        "exam_format": json.dumps({
            "sections": [
                {"name": "Multiple Choice", "count": 60, "minutes": 90, "calculator": True},
                {"name": "Free Response", "count": 7, "minutes": 105, "calculator": True}
            ],
            "reference": "Periodic Table, Equation Sheet"
        }),
        "units": [
            {"number": 1, "title": "Atomic Structure and Properties", "topics": [
                {"num": "1.1", "title": "Moles and Molar Mass"},
                {"num": "1.2", "title": "Mass Spectroscopy of Elements"},
                {"num": "1.3", "title": "Elemental Composition of Pure Substances"},
                {"num": "1.4", "title": "Composition of Mixtures"},
                {"num": "1.5", "title": "Atomic Structure and Electron Configuration"},
                {"num": "1.6", "title": "Photoelectron Spectroscopy"},
                {"num": "1.7", "title": "Periodic Trends"},
                {"num": "1.8", "title": "Valence Electrons and Ionic Compounds"},
            ]},
            {"number": 2, "title": "Molecular and Ionic Compound Structure and Properties", "topics": [
                {"num": "2.1", "title": "Types of Chemical Bonds"},
                {"num": "2.2", "title": "Intramolecular Force and Potential Energy"},
                {"num": "2.3", "title": "Structure of Ionic Solids"},
                {"num": "2.4", "title": "Structure of Metals and Alloys"},
                {"num": "2.5", "title": "Lewis Diagrams"},
                {"num": "2.6", "title": "Resonance and Formal Charge"},
                {"num": "2.7", "title": "VSEPR and Bond Hybridization"},
            ]},
            {"number": 3, "title": "Intermolecular Forces and Properties", "topics": [
                {"num": "3.1", "title": "Intermolecular Forces"},
                {"num": "3.2", "title": "Properties of Solids"},
                {"num": "3.3", "title": "Solids, Liquids, and Gases"},
                {"num": "3.4", "title": "Ideal Gas Law"},
                {"num": "3.5", "title": "Kinetic Molecular Theory"},
                {"num": "3.6", "title": "Deviation from Ideal Gas Law"},
                {"num": "3.7", "title": "Solutions and Mixtures"},
                {"num": "3.8", "title": "Representations of Solutions"},
                {"num": "3.9", "title": "Separation of Solutions and Mixtures Chromatography"},
                {"num": "3.10", "title": "Solubility"},
                {"num": "3.11", "title": "Spectroscopy and the Electromagnetic Spectrum"},
                {"num": "3.12", "title": "Photoelectric Effect"},
                {"num": "3.13", "title": "Beer-Lambert Law"},
            ]},
            {"number": 4, "title": "Chemical Reactions", "topics": [
                {"num": "4.1", "title": "Introduction for Reactions"},
                {"num": "4.2", "title": "Net Ionic Equations"},
                {"num": "4.3", "title": "Representations of Reactions"},
                {"num": "4.4", "title": "Physical and Chemical Changes"},
                {"num": "4.5", "title": "Stoichiometry"},
                {"num": "4.6", "title": "Introduction to Titration"},
                {"num": "4.7", "title": "Types of Chemical Reactions"},
                {"num": "4.8", "title": "Introduction to Acid-Base Reactions"},
                {"num": "4.9", "title": "Oxidation-Reduction (Redox) Reactions"},
            ]},
            {"number": 5, "title": "Kinetics", "topics": [
                {"num": "5.1", "title": "Reaction Rates"},
                {"num": "5.2", "title": "Introduction to Rate Law"},
                {"num": "5.3", "title": "Concentration Changes Over Time"},
                {"num": "5.4", "title": "Elementary Reactions"},
                {"num": "5.5", "title": "Collision Model"},
                {"num": "5.6", "title": "Reaction Energy Profile"},
                {"num": "5.7", "title": "Introduction to Reaction Mechanisms"},
                {"num": "5.8", "title": "Reaction Mechanism and Rate Law"},
                {"num": "5.9", "title": "Steady-State Approximation"},
                {"num": "5.10", "title": "Multistep Reaction Energy Profile"},
                {"num": "5.11", "title": "Catalysis"},
            ]},
            {"number": 6, "title": "Thermodynamics", "topics": [
                {"num": "6.1", "title": "Endothermic and Exothermic Processes"},
                {"num": "6.2", "title": "Energy Diagrams"},
                {"num": "6.3", "title": "Heat Transfer and Thermal Equilibrium"},
                {"num": "6.4", "title": "Heat Capacity and Calorimetry"},
                {"num": "6.5", "title": "Energy of Phase Changes"},
                {"num": "6.6", "title": "Introduction to Enthalpy of Reaction"},
                {"num": "6.7", "title": "Bond Enthalpies"},
                {"num": "6.8", "title": "Enthalpy of Formation"},
                {"num": "6.9", "title": "Hess's Law"},
            ]},
            {"number": 7, "title": "Equilibrium", "topics": [
                {"num": "7.1", "title": "Introduction to Equilibrium"},
                {"num": "7.2", "title": "Direction of Reversible Reactions"},
                {"num": "7.3", "title": "Reaction Quotient and Equilibrium Constant"},
                {"num": "7.4", "title": "Calculating the Equilibrium Constant"},
                {"num": "7.5", "title": "Magnitude of the Equilibrium Constant"},
                {"num": "7.6", "title": "Properties of the Equilibrium Constant"},
                {"num": "7.7", "title": "Calculating Equilibrium Concentrations"},
                {"num": "7.8", "title": "Representations of Equilibrium"},
                {"num": "7.9", "title": "Introduction to Le Chatelier's Principle"},
                {"num": "7.10", "title": "Reaction Quotient and Le Chatelier's Principle"},
                {"num": "7.11", "title": "Introduction to Solubility Equilibria"},
                {"num": "7.12", "title": "Common-Ion Effect"},
                {"num": "7.13", "title": "pH and Solubility"},
                {"num": "7.14", "title": "Free Energy of Dissolution"},
            ]},
            {"number": 8, "title": "Acids and Bases", "topics": [
                {"num": "8.1", "title": "Introduction to Acids and Bases"},
                {"num": "8.2", "title": "pH and pOH of Strong Acids and Bases"},
                {"num": "8.3", "title": "Weak Acid and Base Equilibria"},
                {"num": "8.4", "title": "Acid-Base Reactions and Buffers"},
                {"num": "8.5", "title": "Acid-Base Titrations"},
                {"num": "8.6", "title": "Molecular Structure of Acids and Bases"},
                {"num": "8.7", "title": "pH and pKa"},
                {"num": "8.8", "title": "Properties of Buffers"},
                {"num": "8.9", "title": "Henderson-Hasselbalch Equation"},
                {"num": "8.10", "title": "Buffer Capacity"},
            ]},
            {"number": 9, "title": "Applications of Thermodynamics", "topics": [
                {"num": "9.1", "title": "Introduction to Entropy"},
                {"num": "9.2", "title": "Absolute Entropy and Entropy Change"},
                {"num": "9.3", "title": "Gibbs Free Energy and Thermodynamic Favorability"},
                {"num": "9.4", "title": "Thermodynamic and Kinetic Control"},
                {"num": "9.5", "title": "Free Energy and Equilibrium"},
                {"num": "9.6", "title": "Coupled Reactions"},
                {"num": "9.7", "title": "Galvanic (Voltaic) and Electrolytic Cells"},
                {"num": "9.8", "title": "Cell Potential and Free Energy"},
                {"num": "9.9", "title": "Cell Potential Under Nonstandard Conditions"},
                {"num": "9.10", "title": "Electrolysis and Faraday's Law"},
            ]},
        ]
    },
    {
        "code": "AP_PHYS1",
        "name": "AP Physics 1: Algebra-Based",
        "subject_area": "science",
        "description": "Introductory physics covering mechanics, waves, and simple circuits using algebra-based approaches.",
        "exam_format": json.dumps({
            "sections": [
                {"name": "Multiple Choice", "count": 50, "minutes": 90, "calculator": True},
                {"name": "Free Response", "count": 5, "minutes": 90, "calculator": True}
            ],
            "reference": "Equation Sheet"
        }),
        "units": [
            {"number": 1, "title": "Kinematics", "topics": [
                {"num": "1.1", "title": "Position, Velocity, and Acceleration"},
                {"num": "1.2", "title": "Representations of Motion"},
                {"num": "1.3", "title": "Acceleration"},
            ]},
            {"number": 2, "title": "Dynamics", "topics": [
                {"num": "2.1", "title": "Systems and Center of Mass"},
                {"num": "2.2", "title": "Forces and Free-Body Diagrams"},
                {"num": "2.3", "title": "Newton's Third Law"},
                {"num": "2.4", "title": "Newton's First Law"},
                {"num": "2.5", "title": "Newton's Second Law"},
                {"num": "2.6", "title": "Gravitational Force"},
                {"num": "2.7", "title": "Applications of Newton's Second Law"},
            ]},
            {"number": 3, "title": "Circular Motion and Gravitation", "topics": [
                {"num": "3.1", "title": "Vector Fields"},
                {"num": "3.2", "title": "Fundamental Forces"},
                {"num": "3.3", "title": "Gravitational and Electric Forces"},
                {"num": "3.4", "title": "Gravitational Field/Acceleration Due to Gravity"},
                {"num": "3.5", "title": "Inertial vs. Gravitational Mass"},
                {"num": "3.6", "title": "Centripetal Acceleration and Centripetal Force"},
                {"num": "3.7", "title": "Free-Body Diagrams for Objects in Uniform Circular Motion"},
            ]},
            {"number": 4, "title": "Energy", "topics": [
                {"num": "4.1", "title": "Open and Closed Systems: Energy"},
                {"num": "4.2", "title": "Work and Mechanical Energy"},
                {"num": "4.3", "title": "Conservation of Energy"},
                {"num": "4.4", "title": "Power"},
            ]},
            {"number": 5, "title": "Momentum", "topics": [
                {"num": "5.1", "title": "Momentum and Impulse"},
                {"num": "5.2", "title": "Representations of Changes in Momentum"},
                {"num": "5.3", "title": "Open and Closed Systems: Momentum"},
                {"num": "5.4", "title": "Conservation of Linear Momentum"},
            ]},
            {"number": 6, "title": "Simple Harmonic Motion", "topics": [
                {"num": "6.1", "title": "Period of Simple Harmonic Oscillators"},
                {"num": "6.2", "title": "Energy of a Simple Harmonic Oscillator"},
            ]},
            {"number": 7, "title": "Torque and Rotational Motion", "topics": [
                {"num": "7.1", "title": "Rotational Kinematics"},
                {"num": "7.2", "title": "Torque and Angular Acceleration"},
                {"num": "7.3", "title": "Angular Momentum and Torque"},
                {"num": "7.4", "title": "Conservation of Angular Momentum"},
            ]},
        ]
    },
    {
        "code": "AP_PHYS2",
        "name": "AP Physics 2: Algebra-Based",
        "subject_area": "science",
        "description": "Second-year physics covering fluids, thermodynamics, electricity, magnetism, optics, and modern physics.",
        "exam_format": json.dumps({
            "sections": [
                {"name": "Multiple Choice", "count": 50, "minutes": 90, "calculator": True},
                {"name": "Free Response", "count": 4, "minutes": 90, "calculator": True}
            ],
            "reference": "Equation Sheet"
        }),
        "units": [
            {"number": 1, "title": "Fluids", "topics": [
                {"num": "1.1", "title": "Fluids, Density, and Pressure"},
                {"num": "1.2", "title": "Buoyancy"},
                {"num": "1.3", "title": "Fluid Dynamics and Continuity"},
                {"num": "1.4", "title": "Bernoulli's Equation"},
            ]},
            {"number": 2, "title": "Thermodynamics", "topics": [
                {"num": "2.1", "title": "Thermodynamic Systems"},
                {"num": "2.2", "title": "Pressure, Thermal Equilibrium, and the Ideal Gas Law"},
                {"num": "2.3", "title": "Thermodynamics and Forces"},
                {"num": "2.4", "title": "Thermodynamics and Energy"},
                {"num": "2.5", "title": "Thermodynamics and Probability"},
            ]},
            {"number": 3, "title": "Electric Force, Field, and Potential", "topics": [
                {"num": "3.1", "title": "Electric Charge"},
                {"num": "3.2", "title": "Conservation and Transfer of Electric Charge"},
                {"num": "3.3", "title": "Electric Force"},
                {"num": "3.4", "title": "Electric Field"},
                {"num": "3.5", "title": "Electric Potential Energy and Electric Potential"},
            ]},
            {"number": 4, "title": "Electric Circuits", "topics": [
                {"num": "4.1", "title": "Definition and Conservation of Electric Charge"},
                {"num": "4.2", "title": "Resistivity and Resistance"},
                {"num": "4.3", "title": "Resistors in Series and Parallel"},
                {"num": "4.4", "title": "Kirchhoff's Junction Rule and the Conservation of Electric Charge"},
                {"num": "4.5", "title": "Kirchhoff's Loop Rule and the Conservation of Energy"},
            ]},
            {"number": 5, "title": "Magnetism and Electromagnetic Induction", "topics": [
                {"num": "5.1", "title": "Magnetic Systems and Magnetic Fields"},
                {"num": "5.2", "title": "Magnetic Forces"},
                {"num": "5.3", "title": "Magnetic Flux and Faraday's Law"},
            ]},
            {"number": 6, "title": "Geometric and Physical Optics", "topics": [
                {"num": "6.1", "title": "Waves"},
                {"num": "6.2", "title": "Electromagnetic Waves"},
                {"num": "6.3", "title": "Reflection and Refraction"},
                {"num": "6.4", "title": "Interference and Diffraction"},
            ]},
            {"number": 7, "title": "Quantum, Atomic, and Nuclear Physics", "topics": [
                {"num": "7.1", "title": "Systems and Fundamental Forces"},
                {"num": "7.2", "title": "Radioactive Decay"},
                {"num": "7.3", "title": "Energy in Modern Physics (Photoelectric Effect, Mass-Energy)"},
            ]},
        ]
    },
    {
        "code": "AP_PHYSC_MECH",
        "name": "AP Physics C: Mechanics",
        "subject_area": "science",
        "description": "Calculus-based mechanics covering kinematics, Newton's laws, energy, momentum, rotation, and oscillations.",
        "exam_format": json.dumps({
            "sections": [
                {"name": "Multiple Choice", "count": 35, "minutes": 45, "calculator": True},
                {"name": "Free Response", "count": 3, "minutes": 45, "calculator": True}
            ],
            "reference": "Equation Sheet"
        }),
        "units": [
            {"number": 1, "title": "Kinematics", "topics": [
                {"num": "1.1", "title": "Motion in One Dimension"},
                {"num": "1.2", "title": "Motion in Two Dimensions"},
            ]},
            {"number": 2, "title": "Newton's Laws of Motion", "topics": [
                {"num": "2.1", "title": "Newton's First Law"},
                {"num": "2.2", "title": "Newton's Second Law"},
                {"num": "2.3", "title": "Newton's Third Law"},
                {"num": "2.4", "title": "Applications of Newton's Laws (friction, drag, inclines)"},
            ]},
            {"number": 3, "title": "Work, Energy, and Power", "topics": [
                {"num": "3.1", "title": "Work-Energy Theorem"},
                {"num": "3.2", "title": "Potential Energy and Conservative Forces"},
                {"num": "3.3", "title": "Conservation of Energy"},
                {"num": "3.4", "title": "Power"},
            ]},
            {"number": 4, "title": "Systems of Particles and Linear Momentum", "topics": [
                {"num": "4.1", "title": "Center of Mass"},
                {"num": "4.2", "title": "Impulse and Momentum"},
                {"num": "4.3", "title": "Conservation of Linear Momentum and Collisions"},
            ]},
            {"number": 5, "title": "Rotation", "topics": [
                {"num": "5.1", "title": "Torque and Rotational Statics"},
                {"num": "5.2", "title": "Rotational Kinematics"},
                {"num": "5.3", "title": "Rotational Dynamics and Energy"},
                {"num": "5.4", "title": "Angular Momentum and Its Conservation"},
            ]},
            {"number": 6, "title": "Oscillations", "topics": [
                {"num": "6.1", "title": "Simple Harmonic Motion"},
                {"num": "6.2", "title": "Springs and Pendulums"},
            ]},
            {"number": 7, "title": "Gravitation", "topics": [
                {"num": "7.1", "title": "Newton's Law of Gravitation"},
                {"num": "7.2", "title": "Orbits and Kepler's Laws"},
            ]},
        ]
    },
    {
        "code": "AP_PHYSC_EM",
        "name": "AP Physics C: Electricity and Magnetism",
        "subject_area": "science",
        "description": "Calculus-based electricity and magnetism covering electrostatics, circuits, magnetism, and electromagnetic induction.",
        "exam_format": json.dumps({
            "sections": [
                {"name": "Multiple Choice", "count": 35, "minutes": 45, "calculator": True},
                {"name": "Free Response", "count": 3, "minutes": 45, "calculator": True}
            ],
            "reference": "Equation Sheet"
        }),
        "units": [
            {"number": 1, "title": "Electrostatics", "topics": [
                {"num": "1.1", "title": "Electric Charge and Coulomb's Law"},
                {"num": "1.2", "title": "Electric Field"},
                {"num": "1.3", "title": "Electric Potential and Potential Energy"},
                {"num": "1.4", "title": "Gauss's Law"},
            ]},
            {"number": 2, "title": "Conductors, Capacitors, Dielectrics", "topics": [
                {"num": "2.1", "title": "Electrostatics with Conductors"},
                {"num": "2.2", "title": "Capacitors"},
                {"num": "2.3", "title": "Dielectrics"},
            ]},
            {"number": 3, "title": "Electric Circuits", "topics": [
                {"num": "3.1", "title": "Current, Resistance, and Power"},
                {"num": "3.2", "title": "Steady-State Direct-Current Circuits with Batteries and Resistors"},
                {"num": "3.3", "title": "RC Circuits"},
            ]},
            {"number": 4, "title": "Magnetic Fields", "topics": [
                {"num": "4.1", "title": "Forces on Moving Charges in Magnetic Fields"},
                {"num": "4.2", "title": "Forces on Current-Carrying Wires in Magnetic Fields"},
                {"num": "4.3", "title": "Fields of Long Current-Carrying Wires (Biot-Savart, Ampere's Law)"},
            ]},
            {"number": 5, "title": "Electromagnetism", "topics": [
                {"num": "5.1", "title": "Electromagnetic Induction (Faraday's Law, Lenz's Law)"},
                {"num": "5.2", "title": "Inductance (Including LR and LC Circuits)"},
                {"num": "5.3", "title": "Maxwell's Equations (Qualitative)"},
            ]},
        ]
    },
    {
        "code": "AP_ENV_SCI",
        "name": "AP Environmental Science",
        "subject_area": "science",
        "description": "Interdisciplinary course covering ecosystems, biodiversity, populations, resources, pollution, and climate change.",
        "exam_format": json.dumps({
            "sections": [
                {"name": "Multiple Choice", "count": 80, "minutes": 90, "calculator": True},
                {"name": "Free Response", "count": 3, "minutes": 70, "calculator": True}
            ]
        }),
        "units": [
            {"number": 1, "title": "The Living World: Ecosystems", "topics": [
                {"num": "1.1", "title": "Introduction to Ecosystems"},
                {"num": "1.2", "title": "Terrestrial Biomes"},
                {"num": "1.3", "title": "Aquatic Biomes"},
                {"num": "1.4", "title": "The Carbon Cycle"},
                {"num": "1.5", "title": "The Nitrogen Cycle"},
                {"num": "1.6", "title": "The Phosphorus Cycle"},
                {"num": "1.7", "title": "The Hydrologic (Water) Cycle"},
                {"num": "1.8", "title": "Primary Productivity"},
                {"num": "1.9", "title": "Trophic Levels"},
                {"num": "1.10", "title": "Energy Flow and the 10% Rule"},
                {"num": "1.11", "title": "Food Chains and Food Webs"},
            ]},
            {"number": 2, "title": "The Living World: Biodiversity", "topics": [
                {"num": "2.1", "title": "Introduction to Biodiversity"},
                {"num": "2.2", "title": "Ecosystem Services"},
                {"num": "2.3", "title": "Island Biogeography"},
                {"num": "2.4", "title": "Ecological Tolerance"},
                {"num": "2.5", "title": "Natural Disruptions to Ecosystems"},
                {"num": "2.6", "title": "Adaptations"},
                {"num": "2.7", "title": "Ecological Succession"},
            ]},
            {"number": 3, "title": "Populations", "topics": [
                {"num": "3.1", "title": "Generalist and Specialist Species"},
                {"num": "3.2", "title": "K-Selected and r-Selected Species"},
                {"num": "3.3", "title": "Survivorship Curves"},
                {"num": "3.4", "title": "Carrying Capacity"},
                {"num": "3.5", "title": "Population Growth and Resource Availability"},
                {"num": "3.6", "title": "Age Structure Diagrams"},
                {"num": "3.7", "title": "Total Fertility Rate"},
                {"num": "3.8", "title": "Human Population Dynamics"},
                {"num": "3.9", "title": "Demographic Transition"},
            ]},
            {"number": 4, "title": "Earth Systems and Resources", "topics": [
                {"num": "4.1", "title": "Plate Tectonics"},
                {"num": "4.2", "title": "Soil Formation and Erosion"},
                {"num": "4.3", "title": "Soil Composition and Properties"},
                {"num": "4.4", "title": "Earth's Atmosphere"},
                {"num": "4.5", "title": "Global Wind Patterns"},
                {"num": "4.6", "title": "Watersheds"},
                {"num": "4.7", "title": "Solar Radiation and Earth's Seasons"},
                {"num": "4.8", "title": "Earth's Geography and Climate"},
                {"num": "4.9", "title": "El Nino and La Nina"},
            ]},
            {"number": 5, "title": "Land and Water Use", "topics": [
                {"num": "5.1", "title": "The Tragedy of the Commons"},
                {"num": "5.2", "title": "Clearcutting"},
                {"num": "5.3", "title": "The Green Revolution"},
                {"num": "5.4", "title": "Impacts of Agricultural Practices"},
                {"num": "5.5", "title": "Irrigation Methods"},
                {"num": "5.6", "title": "Pest Control Methods"},
                {"num": "5.7", "title": "Meat Production Methods"},
                {"num": "5.8", "title": "Impacts of Overfishing"},
                {"num": "5.9", "title": "Impacts of Mining"},
                {"num": "5.10", "title": "Impacts of Urbanization"},
                {"num": "5.11", "title": "Ecological Footprints"},
                {"num": "5.12", "title": "Introduction to Sustainability"},
            ]},
            {"number": 6, "title": "Energy Resources and Consumption", "topics": [
                {"num": "6.1", "title": "Renewable and Nonrenewable Resources"},
                {"num": "6.2", "title": "Global Energy Consumption"},
                {"num": "6.3", "title": "Fuel Types and Uses"},
                {"num": "6.4", "title": "Distribution of Natural Energy Resources"},
                {"num": "6.5", "title": "Fossil Fuels"},
                {"num": "6.6", "title": "Nuclear Power"},
                {"num": "6.7", "title": "Energy from Biomass"},
                {"num": "6.8", "title": "Solar Energy"},
                {"num": "6.9", "title": "Hydroelectric Power"},
                {"num": "6.10", "title": "Geothermal Energy"},
                {"num": "6.11", "title": "Hydrogen Fuel Cells"},
                {"num": "6.12", "title": "Wind Energy"},
                {"num": "6.13", "title": "Energy Conservation"},
            ]},
            {"number": 7, "title": "Atmospheric Pollution", "topics": [
                {"num": "7.1", "title": "Introduction to Air Pollution"},
                {"num": "7.2", "title": "Photochemical Smog"},
                {"num": "7.3", "title": "Thermal Inversion"},
                {"num": "7.4", "title": "Atmospheric CO2 and Particulates"},
                {"num": "7.5", "title": "Indoor Air Pollutants"},
                {"num": "7.6", "title": "Reduction of Air Pollutants"},
                {"num": "7.7", "title": "Acid Rain"},
                {"num": "7.8", "title": "Noise Pollution"},
            ]},
            {"number": 8, "title": "Aquatic and Terrestrial Pollution", "topics": [
                {"num": "8.1", "title": "Sources of Pollution"},
                {"num": "8.2", "title": "Human Impacts on Ecosystems"},
                {"num": "8.3", "title": "Endocrine Disruptors"},
                {"num": "8.4", "title": "Human Impacts on Wetlands and Mangroves"},
                {"num": "8.5", "title": "Eutrophication"},
                {"num": "8.6", "title": "Thermal Pollution"},
                {"num": "8.7", "title": "Persistent Organic Pollutants (POPs)"},
                {"num": "8.8", "title": "Bioaccumulation and Biomagnification"},
                {"num": "8.9", "title": "Solid Waste Disposal"},
                {"num": "8.10", "title": "Waste Reduction Methods"},
                {"num": "8.11", "title": "Sewage Treatment"},
                {"num": "8.12", "title": "Lethal Dose 50% (LD50)"},
                {"num": "8.13", "title": "Dose Response Curves"},
                {"num": "8.14", "title": "Pollution Legislation"},
            ]},
            {"number": 9, "title": "Global Change", "topics": [
                {"num": "9.1", "title": "Stratospheric Ozone Depletion"},
                {"num": "9.2", "title": "Reducing Ozone Depletion"},
                {"num": "9.3", "title": "The Greenhouse Effect"},
                {"num": "9.4", "title": "Increases in the Greenhouse Effect"},
                {"num": "9.5", "title": "Global Climate Change"},
                {"num": "9.6", "title": "Ocean Warming"},
                {"num": "9.7", "title": "Ocean Acidification"},
                {"num": "9.8", "title": "Invasive Species"},
                {"num": "9.9", "title": "Endangered Species"},
                {"num": "9.10", "title": "Human Impacts on Biodiversity"},
            ]},
        ]
    },
]


def seed_all_courses():
    """Seed all 13 AP courses with units, topics into the database."""
    init_db()
    db = get_db()

    try:
        # Check if already seeded
        existing = db.query(Course).count()
        if existing > 0:
            print(f"Database already has {existing} courses. Skipping seed.")
            print("To re-seed, delete data/ap_academy.db and run again.")
            return

        total_topics = 0
        for course_data in AP_COURSES:
            course = Course(
                code=course_data["code"],
                name=course_data["name"],
                subject_area=course_data["subject_area"],
                description=course_data["description"],
                exam_format=course_data.get("exam_format"),
            )
            db.add(course)
            db.flush()  # get course.id

            for unit_data in course_data.get("units", []):
                unit = Unit(
                    course_id=course.id,
                    unit_number=unit_data["number"],
                    title=unit_data["title"],
                )
                db.add(unit)
                db.flush()

                for topic_data in unit_data.get("topics", []):
                    topic = Topic(
                        unit_id=unit.id,
                        topic_number=topic_data["num"],
                        title=topic_data["title"],
                    )
                    db.add(topic)
                    total_topics += 1

            print(f"  Seeded: {course.name}")

        db.commit()
        print(f"\nDone! Seeded {len(AP_COURSES)} courses with {total_topics} topics.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding: {e}")
        raise
    finally:
        db.close()


def _hash_password(password: str) -> str:
    """Simple SHA-256 hash for test users. Replace with bcrypt for production."""
    return hashlib.sha256(password.encode()).hexdigest()


TEST_USERS = [
    {"username": "student1", "password": "student1234", "display_name": "Test Student", "role": "student"},
    {"username": "admin1", "password": "admin1234", "display_name": "Test Admin", "role": "admin"},
]


def seed_test_users():
    """Seed test users into the database."""
    init_db()
    db = get_db()

    try:
        # Upsert: update existing users or create new ones
        for user_data in TEST_USERS:
            existing = db.query(User).filter(User.username == user_data["username"]).first()
            if existing:
                # Do NOT reset password — only update display name and role
                existing.display_name = user_data["display_name"]
                existing.role = user_data["role"]
                print(f"  Exists (skipping password reset): {existing.username} ({existing.role})")
            else:
                user = User(
                    username=user_data["username"],
                    password_hash=_hash_password(user_data["password"]),
                    display_name=user_data["display_name"],
                    role=user_data["role"],
                )
                db.add(user)
                print(f"  Seeded user: {user.username} ({user.role})")

        db.commit()
        print(f"Done! Seeded {len(TEST_USERS)} test users.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding users: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_all_courses()
    seed_test_users()
