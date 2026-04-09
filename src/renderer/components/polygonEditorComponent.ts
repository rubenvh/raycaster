import { connect } from '../../common/store/store-connector';
import { useAppDispatch } from '../../common/store';
import { isPolygon } from '../../common/selection/selectable';
import { queryPolygon } from '../../common/geometry/geometry';
import { IPolygon, isConvex } from '../../common/geometry/polygon';
import { IEdge } from '../../common/geometry/edge';
import { IEntityKey } from '../../common/geometry/entity';
import { adaptEdges, adaptPolygonSurfaces } from '../../common/store/walls';
import DirectedMaterialEditorComponent from './directed-material.component';
import MaterialEditorComponent from './materialEditorComponent';
import { cloneMaterial, IMaterial } from '../../common/geometry/properties';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style>
:host {
    display: block;
    font-family: monospace;
    font-size: 11px;
    color: #ccc;
}
:host([hidden]) {
    display: none;
}
.row {
    display: flex;
    align-items: center;
    padding: 1px 0;
    gap: 4px;
}
.label {
    color: #aaa;
    min-width: 5em;
}
.value {
    color: #eee;
}
.section {
    margin-bottom: 6px;
}
.section-label {
    color: #999;
    font-size: 10px;
    text-transform: uppercase;
    margin-bottom: 2px;
    margin-top: 6px;
}
input[type="checkbox"] {
    accent-color: #42a5f5;
}
.json {
    color: #999;
    font-size: 10px;
    word-break: break-all;
    margin-top: 4px;
    padding: 4px;
    background: #1a1a1a;
    border: 1px solid #444;
    border-radius: 2px;
}
</style>
<div class="section">
    <div class="row"><span class="label">id:</span><span id="identifier" class="value"></span></div>
    <div class="row"><span class="label">convex:</span><input id="convex" type="checkbox" /></div>
    <div class="row"><span class="label">edges:</span><span id="edge_count" class="value"></span></div>
</div>
<div class="section">
    <div class="row"><span class="label">immaterial:</span><input id="immaterial" type="checkbox" /></div>
</div>
<div class="section">
    <div class="section-label">Material</div>
    <directed-material-editor id="material"></directed-material-editor>
</div>
<div class="section">
    <div class="section-label">Floor</div>
    <div class="row"><span class="label">enabled:</span><input id="floor_enabled" type="checkbox" /></div>
    <material-editor id="floor_material"></material-editor>
</div>
<div class="section">
    <div class="section-label">Ceiling</div>
    <div class="row"><span class="label">enabled:</span><input id="ceiling_enabled" type="checkbox" /></div>
    <material-editor id="ceiling_material"></material-editor>
</div>
<div class="section">
    <div class="label">vertices:</div>
    <div id="json" class="json"></div>
</div>
`;

const dispatch = useAppDispatch();

export default class PolygonEditorComponent extends HTMLElement {
    private _polygon: IPolygon;
    private idElement: HTMLElement;
    private convexElement: HTMLInputElement;
    private edgeCountElement: HTMLElement;
    private immaterialElement: HTMLInputElement;
    private materialElement: DirectedMaterialEditorComponent;
    private floorEnabledElement: HTMLInputElement;
    private floorMaterialElement: MaterialEditorComponent;
    private ceilingEnabledElement: HTMLInputElement;
    private ceilingMaterialElement: MaterialEditorComponent;
    private jsonElement: HTMLElement;

    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
        
        this.idElement = <HTMLElement>shadowRoot.querySelector('#identifier');
        this.convexElement = <HTMLInputElement>shadowRoot.querySelector('#convex');
        this.convexElement.disabled = true;
        this.edgeCountElement = <HTMLElement>shadowRoot.querySelector('#edge_count');
        this.immaterialElement = <HTMLInputElement>shadowRoot.querySelector('#immaterial');
        this.materialElement = <DirectedMaterialEditorComponent>shadowRoot.querySelector('#material');
        this.floorEnabledElement = <HTMLInputElement>shadowRoot.querySelector('#floor_enabled');
        this.floorMaterialElement = <MaterialEditorComponent>shadowRoot.querySelector('#floor_material');
        this.ceilingEnabledElement = <HTMLInputElement>shadowRoot.querySelector('#ceiling_enabled');
        this.ceilingMaterialElement = <MaterialEditorComponent>shadowRoot.querySelector('#ceiling_material');
        this.jsonElement = <HTMLElement>shadowRoot.querySelector('#json');

        this.immaterialElement.addEventListener('change', (event) => {
            this.adaptAllEdges(_ => {
                _.immaterial = (<HTMLInputElement>event.target).checked;
                return _;
            });
        });

        this.materialElement.addEventListener('change', this.changeMaterial);

        this.floorEnabledElement.addEventListener('change', () => {
            if (!this._polygon) return;
            if (this.floorEnabledElement.checked) {
                const material: IMaterial = this._polygon.floorMaterial ?? { color: [128, 128, 128, 1] };
                dispatch(adaptPolygonSurfaces({ polygonId: this._polygon.id, floorMaterial: material }));
            } else {
                dispatch(adaptPolygonSurfaces({ polygonId: this._polygon.id, floorMaterial: null }));
            }
        });

        this.floorMaterialElement.addEventListener('change', () => {
            if (!this._polygon) return;
            dispatch(adaptPolygonSurfaces({ polygonId: this._polygon.id, floorMaterial: this.floorMaterialElement.material }));
        });

        this.ceilingEnabledElement.addEventListener('change', () => {
            if (!this._polygon) return;
            if (this.ceilingEnabledElement.checked) {
                const material: IMaterial = this._polygon.ceilingMaterial ?? { color: [128, 128, 128, 1] };
                dispatch(adaptPolygonSurfaces({ polygonId: this._polygon.id, ceilingMaterial: material }));
            } else {
                dispatch(adaptPolygonSurfaces({ polygonId: this._polygon.id, ceilingMaterial: null }));
            }
        });

        this.ceilingMaterialElement.addEventListener('change', () => {
            if (!this._polygon) return;
            dispatch(adaptPolygonSurfaces({ polygonId: this._polygon.id, ceilingMaterial: this.ceilingMaterialElement.material }));
        });

        connect(state => {
            const sources = state.textures?.sources ?? [];
            this.materialElement.selectableTextures = sources;
            this.floorMaterialElement.selectableTextures = sources;
            this.ceilingMaterialElement.selectableTextures = sources;
            const selectedElement = state.selection.treeSelection;                                    
            if (isPolygon(selectedElement)) {
                let polygon = queryPolygon(selectedElement.polygon.id, state.walls.geometry);
                this.updatePolygon(polygon);
            }            
        });
    }   

    private changeMaterial = (_: Event) => {
        this.adaptAllEdges(_ => {
            _.material = this.materialElement.material;
            return _;
        });
    }

    private adaptAllEdges = (transformer: ((edge: IEdge) => IEdge)): void => {
        if (!this._polygon) return;
        dispatch(adaptEdges({
            edgeMap: new Map<IEntityKey, IEdge[]>([[this._polygon.id, this._polygon.edges]]),
            transformer
        }));
    };
   
    public updatePolygon (polygon: IPolygon) {
        if (this._polygon !== polygon) {
            this._polygon = polygon;            
            this.render();
        } 
    }
    
    private render() {
        this.idElement.innerText = this._polygon.id;
        this.convexElement.checked = isConvex(this._polygon);
        this.edgeCountElement.innerText = String(this._polygon.edgeCount);
        this.immaterialElement.checked = this._polygon.edges[0]?.immaterial ?? false;
        this.materialElement.material = this._polygon.edges[0]?.material;

        const hasFloor = this._polygon.floorMaterial != null;
        this.floorEnabledElement.checked = hasFloor;
        if (hasFloor) {
            this.floorMaterialElement.material = this._polygon.floorMaterial;
            this.floorMaterialElement.hidden = false;
        } else {
            this.floorMaterialElement.hidden = true;
        }

        const hasCeiling = this._polygon.ceilingMaterial != null;
        this.ceilingEnabledElement.checked = hasCeiling;
        if (hasCeiling) {
            this.ceilingMaterialElement.material = this._polygon.ceilingMaterial;
            this.ceilingMaterialElement.hidden = false;
        } else {
            this.ceilingMaterialElement.hidden = true;
        }

        this.jsonElement.innerText = JSON.stringify(this._polygon.vertices.map(v => v.vector));
    }

   
}

window.customElements.define('polygon-editor', PolygonEditorComponent);
