import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {EventBus} from '../game/EventBus';
import {OUT_UI_PLAYER_LEVEL_UP} from '../constants/EventNames';
import {FEMALE_LEVEL_UP,MALE_LEVEL_UP} from '../constants/SoundFileNames';
import {Gender} from '../Types';
import {soundDialogStore} from '../ui/store/SoundDialog.store';
import {useFullscreenPortalTarget} from '../ui/hooks/utils';

type LevelUpPayload={level:number;previousLevel:number;gender:Gender};

export function LevelUpCelebration(){
    const target=useFullscreenPortalTarget();
    const [event,setEvent]=useState<{level:number;serial:number}>();
    const timer=useRef<number|undefined>(undefined);
    useEffect(()=>{
        const show=({level,gender}:LevelUpPayload)=>{
            const volume=soundDialogStore.state.soundVolume/100;
            if(volume>0){const audio=new Audio(`/assets/sounds/${gender===Gender.FEMALE?FEMALE_LEVEL_UP:MALE_LEVEL_UP}`);audio.volume=volume;void audio.play().catch(()=>undefined)}
            setEvent(current=>({level,serial:(current?.serial??0)+1}));
            window.clearTimeout(timer.current);
            timer.current=window.setTimeout(()=>setEvent(undefined),2600);
        };
        EventBus.on(OUT_UI_PLAYER_LEVEL_UP,show);
        return()=>{EventBus.off(OUT_UI_PLAYER_LEVEL_UP,show);window.clearTimeout(timer.current)};
    },[]);
    if(!event||!target)return null;
    return createPortal(<div className="level-up-celebration" key={event.serial} role="status" aria-live="assertive">
        <div className="level-up-rays"/><div className="level-up-ring outer"/><div className="level-up-ring inner"/>
        <section><span>✦ ASCENSO ✦</span><strong>Nivel {event.level}</strong><small>Tu poder crece · +3 puntos de atributo</small></section>
    </div>,target);
}
