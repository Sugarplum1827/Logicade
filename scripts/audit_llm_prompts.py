"""Export a concrete Canvas prompt; optionally probe/test local Ollama without publishing."""
import argparse
import asyncio
import json
from pathlib import Path

from dotenv import load_dotenv
from server.canvas_prompting import canvas_context, build_canvas_prompt
from server.llm_client import LLMClient

ROOT=Path(__file__).resolve().parents[1]


async def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--week',type=int,default=7,choices=range(1,10))
    parser.add_argument('--level',type=int,default=7,choices=range(1,11))
    parser.add_argument('--trial',type=int,default=1,choices=range(1,11))
    parser.add_argument('--difficulty',default='standard',choices=('needs_support','standard','advanced'))
    parser.add_argument('--output',type=Path,default=ROOT/'artifacts/llm-prompts')
    parser.add_argument('--probe',action='store_true')
    parser.add_argument('--try-model',action='store_true',help='Request parameters only; never writes a game or study data')
    args=parser.parse_args()
    directory=ROOT/'data/fallback_pool'/f'week_{args.week}'/f'level{args.level}'/args.difficulty
    source=next(p for p in directory.glob('game_*.json') if p.name.endswith(f')_{args.trial}.json'))
    template=json.loads(source.read_text(encoding='utf-8'))
    context=canvas_context(template);prompt=build_canvas_prompt(context)
    args.output.mkdir(parents=True,exist_ok=True)
    stem=f'week{args.week}-level{args.level}-{args.difficulty}'
    (args.output/f'{stem}.prompt.txt').write_text(prompt+'\n',encoding='utf-8')
    (args.output/f'{stem}.context.json').write_text(json.dumps(context,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    report={'objective':context['fixed_focus'],'binding':context['binding'],
            'prompt_file':str(args.output/f'{stem}.prompt.txt'),'published':False}
    if args.probe or args.try_model:
        load_dotenv()
        client=LLMClient.from_env()
        try:
            available=await client.probe()
            report['model_available']=available;report['model']=client.model
            if args.try_model and available:
                proposal,meta=await client.propose_canvas_challenge(template)
                report['proposal']=proposal;report['generation']=meta
            elif args.try_model:report['model_trial']='Not run: configured Ollama model is unavailable'
        finally:await client.close()
    (args.output/f'{stem}.audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))


if __name__=='__main__':asyncio.run(main())
