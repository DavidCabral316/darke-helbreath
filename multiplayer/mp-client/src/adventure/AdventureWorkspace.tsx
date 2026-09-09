import {useEffect, type ReactNode, type RefObject} from 'react';
import {createPortal} from 'react-dom';
import type {IRefPhaserGame} from '../PhaserGame';
import {useFullscreenPortalTarget} from '../ui/hooks/utils';
import {EventBus} from '../game/EventBus';
import {NATIVE_OVERLAY_RESIZE_REQUESTED} from '../constants/EventNames';
import {Hotbar} from './Hotbar';
import './workspace.css';

export function AdventureWorkspace({children,phaserRef}:{children:ReactNode;phaserRef:RefObject<IRefPhaserGame|null>}) {
    const target=useFullscreenPortalTarget();
    useEffect(()=>{
        document.body.classList.add('adventure-workspace');
        let frame=0;
        const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
            phaserRef.current?.game?.scale.refresh();EventBus.emit(NATIVE_OVERLAY_RESIZE_REQUESTED);
        });};
        const observer=new ResizeObserver(resize);
        const container=document.getElementById('game-container');if(container)observer.observe(container);
        window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);resize();
        return()=>{document.body.classList.remove('adventure-workspace');observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',resize);document.removeEventListener('fullscreenchange',resize);};
    },[phaserRef]);
    return target?createPortal(<>{children}<Hotbar /></>,target):null;
}
