import asyncio
import json
import httpx
import pytest
from fastapi import FastAPI,HTTPException
from server import main,course_assessments as course

@pytest.fixture
def bank():
    return {"id":"test-midterm","version":"1","approved":True,"items":[
        {"id":"order","topic":"algorithms","format":"choice","prompt":"Test ordering item","choices":["first","second"],"answer":1,"points":2},
        {"id":"output","topic":"simple_c_program_structure","format":"numeric","prompt":"Test numeric item","answer":"7","points":1}]}

def test_private_bank_redacts_answers_and_grades_only_understanding(bank):
    course.validate_bank(bank)
    assert all("answer" not in i for i in course.public_bank(bank)["items"])
    result=course.grade(bank,{"order":1,"output":"7.0"})
    assert result["score"]==3 and result["passed"] is None
    bank["pass_percent"]=80
    assert course.grade(bank,{"order":0,"output":"7"})["passed"] is False
    with pytest.raises(HTTPException):course.grade(bank,{"score":999})
    with pytest.raises(HTTPException):course.grade(bank,{"order":True})

def test_exam_session_is_bound_to_owner_and_exact_bank(bank,monkeypatch):
    monkeypatch.setenv("LOGICADE_SESSION_SECRET","test-only")
    secret=main._session_secret();token=course.issue_attempt("A",bank,secret)
    assert course.verify_attempt(token,"A",bank,secret)["sub"]=="A"
    with pytest.raises(HTTPException):course.verify_attempt(token,"B",bank,secret)
    with pytest.raises(HTTPException):course.verify_attempt(main._issue_session("A"),"A",bank,secret)
    bank["version"]="2"
    with pytest.raises(HTTPException) as err:course.verify_attempt(token,"A",bank,secret)
    assert err.value.status_code==409

def test_missing_or_unapproved_content_is_unavailable(tmp_path,bank):
    path=tmp_path/"bank.json"
    with pytest.raises(HTTPException):course.load_bank(path)
    bank["approved"]=False;path.write_text(json.dumps(bank))
    with pytest.raises(HTTPException):course.load_bank(path)


def test_bank_publication_preserves_versions_and_requires_admin(monkeypatch,tmp_path,bank):
    monkeypatch.setattr(main,"CP1_MIDTERM_BANK_PATH",tmp_path/"private/bank.json")
    def admin(value):
        if value!="admin-test":raise HTTPException(401,"Admin required")
        return "https://database.invalid","fake-key"
    async def audit(*args,**kwargs):pass
    monkeypatch.setattr(main,"_check_admin_key",admin);monkeypatch.setattr(main,"_record_admin_audit",audit)
    async def run():
        with pytest.raises(HTTPException):await main.configure_cp1_midterm(bank,None)
        assert (await main.configure_cp1_midterm(bank,"admin-test"))["approved"] is True
        first=json.loads(json.dumps(bank));bank["items"][0]["answer"]=0
        with pytest.raises(HTTPException) as error:await main.configure_cp1_midterm(bank,"admin-test")
        assert error.value.status_code==409
        assert json.loads(main.CP1_MIDTERM_BANK_PATH.read_text())==first
        bank["version"]="2";await main.configure_cp1_midterm(bank,"admin-test")
        assert (await main.cp1_midterm_bank_status("admin-test"))["version"]=="2"
        assert len(list((main.CP1_MIDTERM_BANK_PATH.parent/"midterm_bank_versions").rglob('*.json')))==2
    asyncio.run(run())

def test_authenticated_grading_is_idempotent_and_uses_existing_assessment_storage(monkeypatch,tmp_path,bank):
    path=tmp_path/"bank.json";path.write_text(json.dumps(bank));monkeypatch.setattr(main,"CP1_MIDTERM_BANK_PATH",path)
    monkeypatch.setenv("LOGICADE_SESSION_SECRET","test-only");monkeypatch.setenv("SUPABASE_URL","https://database.invalid");monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY","test-only-key")
    real=httpx.AsyncClient;saved={};writes=[]
    def db(request):
        if request.url.path=="/rest/v1/audit_logs":return httpx.Response(201,json={})
        if request.method=="POST":
            row=json.loads(request.content);writes.append(row);identity=row["assessment_id"]
            if identity in saved:return httpx.Response(201,json=[])
            saved[identity]=row;return httpx.Response(201,json=[row])
        return httpx.Response(200,json=list(saved.values()))
    monkeypatch.setattr(httpx,"AsyncClient",lambda **kw:real(transport=httpx.MockTransport(db),**kw))
    app=FastAPI();app.get('/api/course/midterm')(main.start_cp1_midterm);app.post('/api/course/midterm')(main.submit_cp1_midterm)
    async def run():
        async with real(transport=httpx.ASGITransport(app=app),base_url="http://test") as client:
            assert (await client.get('/api/course/midterm')).status_code==401
            headers={"Authorization":"Bearer "+main._issue_session("A")}
            start=await client.get('/api/course/midterm',headers=headers);assert start.status_code==200
            assert all('answer' not in q for q in start.json()['bank']['items'])
            payload={"attempt_token":start.json()["attempt_token"],"answers":{"order":1,"output":"7"}}
            spoof=await client.post('/api/course/midterm',headers=headers,json={**payload,"score":999});assert spoof.status_code==422
            result=await client.post('/api/course/midterm',headers=headers,json=payload);assert result.json()["score"]==3
            payload["answers"]={"order":0,"output":"0"}
            duplicate=await client.post('/api/course/midterm',headers=headers,json=payload)
            assert duplicate.json()["score"]==3 and duplicate.json()["assessment_id"]==result.json()["assessment_id"]
            wrong=await client.post('/api/course/midterm',headers={"Authorization":"Bearer "+main._issue_session("B")},json=payload);assert wrong.status_code==401
    asyncio.run(run())
    assert len(saved)==1 and writes[0]["phase"]=="other" and writes[0]["student_id"]=="A"
    assert writes[0]["metadata"]["audit"]["actor"]=="A"
