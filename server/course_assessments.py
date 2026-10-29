"""Private, instructor-configured CP1 assessment content and answer-only grading."""
from __future__ import annotations
import base64
import hashlib
import hmac
import json
import math
import re
import time
from decimal import Decimal, InvalidOperation, DecimalException
from pathlib import Path
from uuid import uuid4
from fastapi import HTTPException

TOPICS={"flowcharting","algorithms","introduction_to_c_language","components_of_c_language","simple_c_program_structure","basic_parts_and_variable_declaration","local_and_global_variables"}

def validate_bank(bank: dict) -> dict:
    if not isinstance(bank,dict) or not re.fullmatch(r"[A-Za-z0-9_-]{1,60}",str(bank.get("id",""))) or not re.fullmatch(r"[A-Za-z0-9_.-]{1,40}",str(bank.get("version",""))):
        raise HTTPException(422,"A bank requires stable id and version fields")
    items=bank.get("items")
    if not isinstance(items,list) or not 1<=len(items)<=50:
        raise HTTPException(422,"Provide 1–50 instructor-reviewed items")
    ids=set()
    for item in items:
        if not isinstance(item,dict) or not re.fullmatch(r"[A-Za-z0-9_-]{1,80}",str(item.get("id",""))) or item["id"] in ids:
            raise HTTPException(422,"Item identifiers must be unique")
        ids.add(item["id"])
        if item.get("topic") not in TOPICS or not isinstance(item.get("prompt"),str) or not 1<=len(item["prompt"])<=3000:
            raise HTTPException(422,"Each item must reference a supplied CP1 topic and a concise prompt")
        if type(item.get("points",1)) is not int or not 1<=item.get("points",1)<=10:
            raise HTTPException(422,"Item points must be integers from 1 to 10")
        if item.get("format")=="choice":
            choices=item.get("choices")
            if not isinstance(choices,list) or not 2<=len(choices)<=6 or any(not isinstance(c,str) or not 1<=len(c)<=1000 for c in choices) or type(item.get("answer")) is not int or not 0<=item["answer"]<len(choices):
                raise HTTPException(422,"Choice items need valid choices and an answer index")
        elif item.get("format")=="numeric":
            try:
                answer=Decimal(str(item["answer"]));tolerance=Decimal(str(item.get("tolerance",0)))
                if not answer.is_finite() or not tolerance.is_finite() or tolerance<0: raise ValueError()
            except (KeyError,InvalidOperation,ValueError):
                raise HTTPException(422,"Numeric items need a finite answer and nonnegative tolerance")
        else:
            raise HTTPException(422,"Supported assessment formats: choice and numeric output prediction")
    cutoff=bank.get("pass_percent")
    if cutoff is not None and (type(cutoff) not in (int,float) or not math.isfinite(cutoff) or not 0<=cutoff<=100):
        raise HTTPException(422,"An optional instructor passing percentage must be between 0 and 100")
    if not isinstance(bank.get("approved"),bool): raise HTTPException(422,"Set the instructor approval flag explicitly")
    return bank

def load_bank(path: Path) -> dict:
    try: bank=validate_bank(json.loads(path.read_text(encoding="utf-8")))
    except (OSError,ValueError,HTTPException): raise HTTPException(409,"The instructor has not configured a valid private midterm bank")
    if not bank["approved"]: raise HTTPException(409,"The instructor has not approved this midterm bank")
    return bank

def digest(bank: dict) -> str:
    return hashlib.sha256(json.dumps(bank,sort_keys=True,separators=(",",":")).encode()).hexdigest()

def public_bank(bank: dict) -> dict:
    return {"id":bank["id"],"version":bank["version"],"title":str(bank.get("title") or "CP1 Midterm"),
        "items":[{k:v for k,v in item.items() if k in {"id","topic","prompt","format","choices","points"}} for item in bank["items"]],
        "total":sum(item.get("points",1) for item in bank["items"]),"pass_percent":bank.get("pass_percent"),"grading_basis":"item_answers_only"}

def issue_attempt(owner: str,bank: dict,secret: bytes) -> str:
    claims={"sub":owner,"purpose":"cp1_midterm","assessment_id":str(uuid4()),"bank_hash":digest(bank),"exp":int(time.time())+7200}
    payload=base64.urlsafe_b64encode(json.dumps(claims,separators=(",",":")).encode()).decode().rstrip("=")
    signature=base64.urlsafe_b64encode(hmac.new(secret,payload.encode(),hashlib.sha256).digest()).decode().rstrip("=")
    return payload+"."+signature

def verify_attempt(token: str,owner: str,bank: dict,secret: bytes) -> dict:
    try:
        payload,signature=token.split(".")
        expected=base64.urlsafe_b64encode(hmac.new(secret,payload.encode(),hashlib.sha256).digest()).decode().rstrip("=")
        if not hmac.compare_digest(signature,expected):raise ValueError()
        claims=json.loads(base64.urlsafe_b64decode(payload+"="*(-len(payload)%4)))
        if claims["sub"]!=owner or claims["exp"]<time.time() or claims.get("purpose")!="cp1_midterm" or not isinstance(claims.get("assessment_id"),str) or not isinstance(claims.get("bank_hash"),str):raise ValueError()
    except (ValueError,KeyError,TypeError):raise HTTPException(401,"The assessment session is invalid or expired")
    if claims["bank_hash"]!=digest(bank):raise HTTPException(409,"The assessment changed; reload it before submitting")
    return claims

def grade(bank: dict,answers: dict) -> dict:
    if not isinstance(answers,dict) or set(answers)-{i["id"] for i in bank["items"]}:raise HTTPException(422,"Unknown assessment item")
    items=[]
    for item in bank["items"]:
        value=answers.get(item["id"])
        if value is not None and (type(value) not in (str,int) or len(str(value))>200):raise HTTPException(422,"Invalid answer type or size")
        if item["format"]=="choice": correct=type(value) is int and value==item["answer"]
        else:
            try:
                number=Decimal(str(value));correct=number.is_finite() and abs(number-Decimal(str(item["answer"])))<=Decimal(str(item.get("tolerance",0)))
            except DecimalException:correct=False
        items.append({"id":item["id"],"topic":item["topic"],"answered":value is not None,"correct":correct,"earned":item.get("points",1) if correct else 0,"maximum":item.get("points",1)})
    score=sum(i["earned"] for i in items);maximum=sum(i["maximum"] for i in items)
    return {"score":score,"maximum_score":maximum,"percent":score/maximum*100,"passed":None if bank.get("pass_percent") is None else score/maximum*100>=bank["pass_percent"],"items":items,"grading_basis":"item_answers_only"}
