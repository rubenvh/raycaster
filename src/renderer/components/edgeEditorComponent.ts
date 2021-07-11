import { ITextureSource } from './../../common/textures/model';
import { distanceToMidPoint } from '../../common/math/lineSegment';
import MaterialEditorComponent from './materialEditorComponent';
import VertexEditorComponent from './vertexEditorComponent';
import { connect } from '../../common/store/store-connector';
import { IEntityKey } from '../../common/geometry/entity';
import { useAppDispatch } from '../../common/store';
import { isEdge } from '../../common/selection/selectable';
import { IEdge } from '../../common/geometry/edge';
import { queryEdge } from '../../common/geometry/geometry';
import { adaptEdges } from '../../common/store/walls';
import { IDirectedMaterial, IMaterial, isDirected } from '../../common/geometry/properties';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style> 
</style>
<div><span id="label_id">id:</span><span id="identifier"></span></div>
<div><span id="label_immaterial">immaterial:</span><input id="immaterial" type="checkbox" /></div>
<div><span id="label_start">start:</span><vertex-editor id="start" hideId></vertex-editor></div>
<div><span id="label_end">end:</span><vertex-editor id="end" hideId></vertex-editor></div>
<div><span id="label_material">material:</span>
    <input id="double_sided" type="checkbox" />
    <material-editor id="front_material"></material-editor>
    <material-editor id="back_material"></material-editor>
</div>
<div><span id="label_stats">stats:</span>
<ul id="stats">    
</ul>
</div>
`;

const dispatch = useAppDispatch();

export default class EdgeEditorComponent extends HTMLElement {
    private _edge: IEdge;
    private _polygonId: IEntityKey;
    private idElement: HTMLElement;
    private immaterialElement: HTMLInputElement;
    private startElement: VertexEditorComponent;
    private endElement: VertexEditorComponent;
    private frontMaterialElement: MaterialEditorComponent;
    private backMaterialElement: MaterialEditorComponent;
    private statsElement: HTMLUListElement;
    private distanceToCamera: (edge: IEdge) => number;
    private doubleSidedMaterialElement: HTMLInputElement;
    

    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});        
        shadowRoot.appendChild(template.content.cloneNode(true));        
        
        this.idElement = <HTMLElement>shadowRoot.querySelector('#identifier');
        this.immaterialElement = <HTMLInputElement>shadowRoot.querySelector('#immaterial');
        this.startElement = <VertexEditorComponent>shadowRoot.querySelector('#start');
        this.endElement = <VertexEditorComponent>shadowRoot.querySelector('#end');
        this.statsElement = <HTMLUListElement>shadowRoot.querySelector('#stats');

        // TODO Split of material editor components and checkbox into separate component
        this.doubleSidedMaterialElement = <HTMLInputElement>shadowRoot.querySelector('#double_sided');
        this.frontMaterialElement = <MaterialEditorComponent>shadowRoot.querySelector('#front_material');
        this.backMaterialElement = <MaterialEditorComponent>shadowRoot.querySelector('#back_material');

        this.immaterialElement.addEventListener('change', (event) => {                       
            this.adaptEdge(_ => {
                _.immaterial = (<HTMLInputElement>event.target).checked;
                return _;
            });
        });        

        this.frontMaterialElement.addEventListener('change', this.changeMaterial);
        this.backMaterialElement.addEventListener('change', this.changeMaterial);
        this.doubleSidedMaterialElement.addEventListener('change', () => {            
            this.adaptEdge(_ => {
                _.material = this.doubleSidedMaterialElement.checked ? [this.frontMaterialElement.material, {color: [0,0,0,0]}] : this.frontMaterialElement.material;
                return _;
            });
        });

        connect(state => {
            this.backMaterialElement.selectableTextures = this.frontMaterialElement.selectableTextures = state.textures?.sources ?? [];             
            const selectedElement = state.selection.treeSelection;                        
            this.distanceToCamera = (edge: IEdge): number => distanceToMidPoint(state.player.camera.position, edge.segment);
            if (isEdge(selectedElement)) {
                let edge = queryEdge(selectedElement.edge.id, selectedElement.polygon.id, state.walls.geometry);                
                this.updateEdge(edge, selectedElement.polygon.id);                
            }            
        });
    } 

    get material(): IDirectedMaterial {
        return this.doubleSidedMaterialElement.checked ? 
            [this.frontMaterialElement.material, this.backMaterialElement.material] 
            : this.frontMaterialElement.material;
    }
    private changeMaterial = (event: Event) => {
        this.adaptEdge(_ => {
            _.material = this.material;
            return _;
        });
    }
    private adaptEdge = (transformer: ((edge: IEdge) => IEdge)): void => {
        dispatch(adaptEdges({edgeMap: new Map<string, IEdge[]>([[this._polygonId, [this._edge]]]),
            transformer}));
    };

    public updateEdge (edge: IEdge, poligonId: IEntityKey) {
        if (this._edge !== edge) {
            this._edge = edge;
            this._polygonId = poligonId;
            this.startElement.updateVertex(edge.start, poligonId);
            this.endElement.updateVertex(edge.end, poligonId);
            this.doubleSidedMaterialElement.checked = this.hasDirectedMaterial;    
            this.render();
        } else {
            this.renderStats();
        }
    }

    private get hasDirectedMaterial() { return isDirected(this._edge.material); }
    private render() {
        this.idElement.innerText = this._edge.id;
        this.immaterialElement.checked = this._edge.immaterial ?? false;                        
        this.frontMaterialElement.material = this.hasDirectedMaterial ? this._edge.material[0] : this._edge.material;
        this.backMaterialElement.material = this.hasDirectedMaterial ? this._edge.material[1] : {color: [0,0,0,0]};
        this.backMaterialElement.style.display = this.doubleSidedMaterialElement.checked ? 'block' : 'none';
        this.renderStats();
    }

    private renderStats() {
        this.statsElement.textContent = '';
        let automaticLuminosity = document.createElement('li');
        automaticLuminosity.textContent = `auto-lumen: ${this._edge.luminosity.toFixed(2)}`;
        let length = document.createElement('li');
        length.textContent = `length: ${this._edge.length.toFixed(2)}`;
        let distance = document.createElement('li');
        distance.textContent = `distance: ${this.distanceToCamera(this._edge).toFixed(2)}`;
        this.statsElement.append(automaticLuminosity, length, distance);
    }
}

window.customElements.define('edge-editor', EdgeEditorComponent);