"""
Formula Extractor for Mathematical Content

Detects and extracts mathematical formulas from text.
Converts formulas to LaTeX format for embedding.

Features:
- Pattern-based formula detection
- LaTeX conversion
- Support for inline and display math
- Formula classification (algebra, geometry, calculus, etc.)
"""

import re
from typing import List, Dict, Tuple, Optional
import logging

logger = logging.getLogger(__name__)

class FormulaExtractor:
    """
    Extracts mathematical formulas from text and converts to LaTeX.
    
    Usage:
        extractor = FormulaExtractor()
        formulas = extractor.extract_formulas("Solve: 2x + 3 = 7")
    """
    
    MATH_PATTERNS = [
        r'([a-zA-Z0-9\s\+\-\*\/\(\)\^\²\³]+\s*=\s*[a-zA-Z0-9\s\+\-\*\/\(\)\^\²\³]+)',
        
        r'(\d+\/\d+|\([^)]+\)\/\([^)]+\))',
        
        r'([a-zA-Z]\^[0-9a-zA-Z]+|[a-zA-Z][²³⁴⁵⁶⁷⁸⁹])',
        
        r'(√\s*[\da-zA-Z\(\)]+)',
        
        r'(α|β|γ|δ|ε|θ|λ|μ|π|σ|φ|ω|Δ|Σ|Π|Ω)',
        
        r'([a-zA-Z0-9\s\+\-\*\/\(\)]+\s*[<>≤≥≠]\s*[a-zA-Z0-9\s\+\-\*\/\(\)]+)',
        
        r'(Σ|∑|Π|∏)',
        
        r'(d[a-zA-Z]\/d[a-zA-Z]|∫|∂)',
    ]
    
    LATEX_MARKERS = [
        r'\$.*?\$',
        r'\$\$.*?\$\$',
        r'\\begin\{equation\}.*?\\end\{equation\}',
        r'\\begin\{align\}.*?\\end\{align\}',
        r'\\frac\{.*?\}\{.*?\}',
        r'\\sqrt\{.*?\}',
    ]
    
    def __init__(self):
        """Initialize formula extractor."""
        self.compiled_patterns = [re.compile(p) for p in self.MATH_PATTERNS]
        self.latex_patterns = [re.compile(p, re.DOTALL) for p in self.LATEX_MARKERS]
        logger.info("🔢 Formula Extractor initialized")
    
    def extract_formulas(self, text: str) -> List[Dict]:
        """
        Extract all formulas from text.
        
        Args:
            text: Input text containing math expressions
        
        Returns:
            List of formula dictionaries with:
                - raw_text: Original formula text
                - latex: LaTeX representation
                - type: inline or display
                - position: Start/end indices
        """
        formulas = []
        
        latex_formulas = self._extract_latex_formulas(text)
        formulas.extend(latex_formulas)
        
        pattern_formulas = self._detect_math_patterns(text)
        formulas.extend(pattern_formulas)
        
        formulas = self._deduplicate_formulas(formulas)
        
        logger.debug(f"   Found {len(formulas)} formulas")
        return formulas
    
    def _extract_latex_formulas(self, text: str) -> List[Dict]:
        """
        Extract formulas already marked with LaTeX syntax.
        
        Args:
            text: Input text
        
        Returns:
            List of formula dictionaries
        """
        formulas = []
        
        for pattern in self.latex_patterns:
            for match in pattern.finditer(text):
                formula_text = match.group(0)
                
                latex = self._clean_latex(formula_text)
                
                formulas.append({
                    "raw_text": formula_text,
                    "latex": latex,
                    "type": "display" if "$$" in formula_text or "\\begin" in formula_text else "inline",
                    "position": match.span(),
                    "confidence": 1.0
                })
        
        return formulas
    
    def _detect_math_patterns(self, text: str) -> List[Dict]:
        """
        Detect mathematical expressions using pattern matching.
        
        Args:
            text: Input text
        
        Returns:
            List of formula dictionaries
        """
        formulas = []
        
        for pattern in self.compiled_patterns:
            for match in pattern.finditer(text):
                formula_text = match.group(0).strip()
                
                if len(formula_text) < 3 or self._is_likely_text(formula_text):
                    continue
                
                latex = self._convert_to_latex(formula_text)
                
                formulas.append({
                    "raw_text": formula_text,
                    "latex": latex,
                    "type": "inline",
                    "position": match.span(),
                    "confidence": 0.8
                })
        
        return formulas
    
    def _convert_to_latex(self, text: str) -> str:
        """
        Convert plain math text to LaTeX format.
        
        Args:
            text: Plain math text (e.g., "2x + 3 = 7")
        
        Returns:
            LaTeX string (e.g., "2x + 3 = 7")
        """
        latex = text
        
        superscript_map = {
            '²': '^2', '³': '^3', '⁴': '^4', '⁵': '^5',
            '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9'
        }
        for unicode_char, latex_char in superscript_map.items():
            latex = latex.replace(unicode_char, latex_char)
        
        latex = re.sub(r'(\d+)\/(\d+)', r'\\frac{\1}{\2}', latex)
        
        latex = re.sub(r'√\s*([a-zA-Z0-9]+)', r'\\sqrt{\1}', latex)
        latex = re.sub(r'√\s*\(([^)]+)\)', r'\\sqrt{\1}', latex)
        
        latex = re.sub(r'([a-zA-Z])\^([0-9a-zA-Z])', r'\1^{\2}', latex)
        
        if not latex.startswith('$'):
            latex = f"${latex}$"
        
        return latex
    
    def _clean_latex(self, formula: str) -> str:
        """
        Clean and normalize LaTeX formula.
        
        Args:
            formula: Raw LaTeX string
        
        Returns:
            Cleaned LaTeX
        """
        formula = formula.replace('$$', '$')
        
        formula = re.sub(r'\\begin\{equation\}(.*?)\\end\{equation\}', r'\1', formula, flags=re.DOTALL)
        formula = re.sub(r'\\begin\{align\}(.*?)\\end\{align\}', r'\1', formula, flags=re.DOTALL)
        
        formula = formula.strip()
        
        if not formula.startswith('$'):
            formula = f"${formula}$"
        
        return formula
    
    def _is_likely_text(self, text: str) -> bool:
        """
        Check if matched text is likely regular text, not a formula.
        
        Args:
            text: Matched text
        
        Returns:
            True if likely not a formula
        """
        words = text.split()
        if len(words) > 6:
            return True
        
        common_words = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on'}
        if any(word.lower() in common_words for word in words):
            return True
        
        return False
    
    def _deduplicate_formulas(self, formulas: List[Dict]) -> List[Dict]:
        """
        Remove duplicate formulas based on overlapping positions.
        
        Args:
            formulas: List of formula dictionaries
        
        Returns:
            Deduplicated list
        """
        if not formulas:
            return []
        
        formulas.sort(key=lambda x: x['position'][0])
        
        deduplicated = []
        for formula in formulas:
            overlaps = False
            for existing in deduplicated:
                if self._positions_overlap(formula['position'], existing['position']):
                    if formula['confidence'] > existing['confidence']:
                        deduplicated.remove(existing)
                    else:
                        overlaps = True
                    break
            
            if not overlaps:
                deduplicated.append(formula)
        
        return deduplicated
    
    @staticmethod
    def _positions_overlap(pos1: Tuple[int, int], pos2: Tuple[int, int]) -> bool:
        """
        Check if two position ranges overlap.
        
        Args:
            pos1: First position (start, end)
            pos2: Second position (start, end)
        
        Returns:
            True if positions overlap
        """
        return not (pos1[1] <= pos2[0] or pos2[1] <= pos1[0])
    
    def classify_formula(self, latex: str) -> str:
        """
        Classify formula by mathematical topic.
        
        Args:
            latex: LaTeX formula string
        
        Returns:
            Topic category
        """
        if any(op in latex for op in ['\\frac', '/', '÷']):
            return "arithmetic"
        elif any(op in latex for op in ['^', '²', '³', '\\sqrt']):
            return "algebra"
        elif any(op in latex for op in ['\\sin', '\\cos', '\\tan', '\\theta', 'π']):
            return "trigonometry"
        elif any(op in latex for op in ['\\int', '\\frac{d', '\\partial']):
            return "calculus"
        elif any(op in latex for op in ['\\angle', '\\triangle', '\\parallel']):
            return "geometry"
        elif any(op in latex for op in ['\\sum', '\\prod', 'Σ', 'Π']):
            return "series"
        else:
            return "general"

if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)
    
    extractor = FormulaExtractor()
    
    test_texts = [
        "Solve the equation: 2x + 3 = 7",
        "The area of a circle is A = πr²",
        "Calculate √(16) + 3/4",
        "The formula is $E = mc^2$ in physics",
        "Find the derivative: dy/dx = 2x + 1",
    ]
    
    for text in test_texts:
        print(f"\nText: {text}")
        formulas = extractor.extract_formulas(text)
        for f in formulas:
            print(f"  Formula: {f['latex']} (confidence: {f['confidence']})")
