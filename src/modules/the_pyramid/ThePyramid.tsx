import { Button, CircularProgress, Paper, Stack, TextField, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import Tree from "react-d3-tree";
import { CustomNodeElementProps, RawNodeDatum } from "react-d3-tree/lib/types/common";
import { uniqueNamesGenerator, names } from "unique-names-generator";
import { nth, remove } from "lodash";
import useInterval from "../../hooks/useInterval";
import { useTimer } from "react-timer-hook";
import Progress from "./Progress";
import numeral from "numeral";
import { Money } from "@mui/icons-material";

interface IAttribute extends Record<string, string | number | boolean> {
    money: number;
    income: number;
}

interface TreeNode extends RawNodeDatum {
    name: string;
    attributes: IAttribute;
    children?: TreeNode[];
}

interface Pyramid extends RawNodeDatum {
    name: string;
    children: TreeNode[];
    attributes: IAttribute;
}

interface IRectangleSvg {
    width: number;
    height: number;
    tl: number;
    tr: number;
    br: number;
    bl: number;
    color: string;
    x?: number;
    y?: number;
}

const LEFT = 0;
const CENTER = 1;
const RIGHT = 2;
const CHILDREN_SIZE = 3;
const CYCLE_INCOME = 2000;
const INTERVAL_TIME = 15;
const PERCENT_TO_OWNER = 20;
// This is a simplified example of an org chart with a depth of 2.
// Note how deeper levels are defined recursively via the `children` property.
// const orgChartMock: Pyramid = {
//     name: "CEO",
//     attributes: {
//         income: 0,
//         money: 0,
//     },
//     children: [
//         {
//             name: "Manager",
//             attributes: {
//                 income: 0,
//                 money: CYCLE_INCOME,
//             },
//             children: [
//                 {
//                     name: "Foreman",
//                     attributes: {
//                         income: 0,
//                         money: 0,
//                     },
//                     children: [
//                         {
//                             name: "Worker",
//                         },
//                     ],
//                 },
//                 {
//                     name: "Foreman",
//                     attributes: {
//                         income: 0,
//                         money: 0,
//                     },
//                     children: [
//                         {
//                             name: "Worker",
//                         },
//                     ],
//                 },
//             ],
//         },
//     ],
// };

const ThePyramid = () => {
    console.debug("Pyramid Component loaded");
    const [currentCycle, setCurrentCycle] = useState<number>(1);
    const [orgChart, setOrgChart] = useState<Pyramid>();
    const [numOfParticipants, setNumOfParticipants] = useState<number>(200);
    const [percentDistributions, setPercentDistributions] = useState<number>(20);

    const { seconds, minutes, hours, days, isRunning, start, pause, resume, restart } = useTimer({
        expiryTimestamp: new Date(),
        onExpire: timerExpired,
        autoStart: false,
    });

    useEffect(() => {
        restartInterval();
    }, []);

    // useInterval(() => {
    //     const newPyramid = updateIncome(orgChart);
    //     setOrgChart(newPyramid);

    // }, 10000);

    function restartInterval() {
        let newTime = new Date();
        newTime.setSeconds(newTime.getSeconds() + INTERVAL_TIME);
        console.debug(newTime.toISOString());

        restart(newTime, true);
    }

    function timerExpired() {
        const newPyramid = setIncome(orgChart as Pyramid);
        setOrgChart(newPyramid);
        setCurrentCycle(currentCycle + 1);
        setTimeout(() => {
            restartInterval();
        }, CYCLE_INCOME);
    }

    function addIncomeToMoneyToChild(node: TreeNode[] | Pyramid[], direction: number) {
        const child = nth(node, direction);
        if (child) {
            if (child.name && child.name.length > 0) {
                addIncomeToMoney(child);
            }
        }
    }

    function addIncomeToMoney(node: TreeNode | Pyramid) {
        const percentReduction = (100 - percentDistributions) / 100;
        node.attributes.money += Number(Number(node.attributes.income * percentReduction).toFixed(2)).valueOf();
        node.attributes.income = 0;
    }

    function seeIfChildShouldSetIncome(children: TreeNode[], direction: number) {
        let income = 0;
        if (nth(children, direction)) {
            let node = nth(children, direction) as TreeNode;
            if (node.name && node.name.length > 0) {
                node = setIncome(node);
            }
            children[direction] = node;
            income += node.attributes.income;
        }

        return income;
    }

    function setIncome(pyramid: TreeNode | Pyramid): Pyramid {
        console.debug("Updating income");
        let clonedPyramid = { ...pyramid } as TreeNode;
        let childrensIncome = 0;

        const children = clonedPyramid.children as TreeNode[];
        if (children && children.length > 0) {
            childrensIncome += seeIfChildShouldSetIncome(children, LEFT);
            childrensIncome += seeIfChildShouldSetIncome(children, CENTER);
            childrensIncome += seeIfChildShouldSetIncome(children, RIGHT);

            clonedPyramid.children = children;
        }

        const percentReduction = percentDistributions / 100;
        const income = CYCLE_INCOME + childrensIncome * percentReduction;
        clonedPyramid.attributes.income += Number(numeral(income).format("0.00"));
        addIncomeToMoneyToChild(children, LEFT);
        addIncomeToMoneyToChild(children, CENTER);
        addIncomeToMoneyToChild(children, RIGHT);

        if (pyramid.attributes.rootNode) {
            addIncomeToMoney(pyramid);
        }
        return clonedPyramid as Pyramid;
    }

    function getDefaultAttributes(): IAttribute {
        return {
            money: CYCLE_INCOME,
            income: 0,
        } as IAttribute;
    }

    function generatePerson(): TreeNode {
        return {
            attributes: {
                money: CYCLE_INCOME,
                income: 0,
            },
            name: uniqueNamesGenerator({
                dictionaries: [names],
                length: 1,
            }),
        };
    }

    function initializeChildren(children: TreeNode[] | undefined): TreeNode[] {
        const newChildren: TreeNode[] = [];
        if (children?.length === 0 || children === undefined) {
            return newChildren;
        } else {
            return children;
        }
    }

    function addPersonToTree(person: TreeNode, pyramid: TreeNode | Pyramid) {
        const random = Math.floor(Math.random() * 11);
        const left = random < 4;
        const center = random >= 4 && random < 7;

        pyramid.children = initializeChildren(pyramid.children);

        const leftFull = childOccupied(pyramid.children[LEFT]);
        const centerFull = childOccupied(pyramid.children[CENTER]);
        const rightFull = childOccupied(pyramid.children[RIGHT]);
        if (left) {
            if (!leftFull) {
                pyramid.children[LEFT] = person;
            } else if (!centerFull) {
                pyramid.children[CENTER] = person;
            } else if (!rightFull) {
                pyramid.children[RIGHT] = person;
            } else {
                addPersonToTree(person, pyramid.children[LEFT]);
            }
        } else if (center) {
            if (!centerFull) {
                pyramid.children[CENTER] = person;
            } else if (!leftFull) {
                pyramid.children[LEFT] = person;
            } else if (!rightFull) {
                pyramid.children[RIGHT] = person;
            } else {
                addPersonToTree(person, pyramid.children[CENTER]);
            }
        } else {
            if (!rightFull) {
                pyramid.children[RIGHT] = person;
            } else if (!centerFull) {
                pyramid.children[CENTER] = person;
            } else if (!leftFull) {
                pyramid.children[LEFT] = person;
            } else {
                addPersonToTree(person, pyramid.children[RIGHT]);
            }
        }
    }

    function childOccupied(childNode: TreeNode) {
        return childNode !== undefined;
    }

    function fixLeaves(pyramid: TreeNode | Pyramid) {
        if (pyramid.children) {
            const leftFull = childOccupied(pyramid.children[LEFT]);
            const centerFull = childOccupied(pyramid.children[CENTER]);
            const rightFull = childOccupied(pyramid.children[RIGHT]);

            if (leftFull) {
                fixLeaves(pyramid.children[LEFT]);
            }

            if (centerFull) {
                fixLeaves(pyramid.children[CENTER]);
            }

            if (rightFull) fixLeaves(pyramid.children[RIGHT]);

            if (!leftFull || !centerFull || !rightFull) {
                remove(pyramid.children, (child) => child === undefined);
            }
        }
    }

    function buildPyramid() {
        setCurrentCycle(1);
        const numOfPeople = numOfParticipants;
        const initialOrg: Pyramid = {
            name: "CEO",
            attributes: {
                income: 0,
                money: CYCLE_INCOME,
                rootNode: true,
            },
            children: [],
        };
        for (let index = 0; index < numOfPeople; index++) {
            const person = generatePerson();
            addPersonToTree(person, initialOrg);
        }
        fixLeaves(initialOrg);
        setOrgChart(initialOrg);
        console.log(orgChart);
    }

    const Rect = ({ width, height, tl, tr, br, bl, color, x, y }: IRectangleSvg) => {
        const top = width - tl - tr;
        const right = height - tr - br;
        const bottom = width - br - bl;
        const left = height - bl - tl;
        const d = `
            M${tl},0
            h${top}
            a${tr},${tr} 0 0 1 ${tr},${tr}
            v${right}
            a${br},${br} 0 0 1 -${br},${br}
            h-${bottom}
            a${bl},${bl} 0 0 1 -${bl},-${bl}
            v-${left}
            a${tl},${tl} 0 0 1 ${tl},-${tl}
            z
        `;
        return (
            <svg width={width} height={height} x={x} y={y}>
                <path d={d} fill={color} />
            </svg>
        );
    };

    function renderCustomNode(props: CustomNodeElementProps) {
        return (
            <g>
                <Rect x={-15} y={-10} width={30} height={30} tl={7} tr={7} bl={7} br={7} color="#1976d2" />

                <text font-family="Arial, Helvetica, sans-serif" fill="black" strokeWidth="1" x="10" y="-15">
                    {props.nodeDatum.name}
                </text>

                <Rect width={125} height={60} tl={7} tr={7} bl={7} br={7} color="white" x={-50} y={25} />
                <text font-family="Arial, Helvetica, sans-serif" fill="black" x={-45} dy="45" strokeWidth="1">
                    ${Number(props.nodeDatum.attributes?.money).toFixed(2)}
                </text>
            </g>
        );
    }

    useEffect(() => {
        buildPyramid();
    }, []);

    return (
        <Stack spacing={3}>
            <Stack display="flex" alignItems="center" spacing={3}>
                <Paper elevation={5} style={{ padding: "15px", minWidth: "250px", marginTop: "10px" }}>
                    <Typography variant="h6">Next Cycle {currentCycle + 1}</Typography>
                    <Progress duration={INTERVAL_TIME} timeLeft={seconds} text="test" />
                </Paper>
            </Stack>
            <Paper elevation={3} id="treeWrapper" style={{ width: "100%", height: "60vh", marginLeft: '7px', marginRight: '10px' }}>
                {orgChart && orgChart?.children?.length > 0 ? (
                    <Tree
                        renderCustomNodeElement={renderCustomNode}
                        data={orgChart as Pyramid}
                        orientation="vertical"
                        pathFunc="elbow"
                    />
                ) : (
                    <CircularProgress />
                )}
            </Paper>
            <Stack display="flex" alignItems="center" spacing={3}>
                <Paper elevation={5} style={{ padding: "15px" }}>
                    <Stack display="flex" alignItems="center" spacing={3}>
                        <Stack direction="row">
                            {isRunning ? (
                                <Button onClick={pause}>Pause</Button>
                            ) : (
                                <Button onClick={resume}>Resume</Button>
                            )}
                            <Button onClick={timerExpired}>Trigger Cycle</Button>
                            <Button onClick={buildPyramid}>Rebuild Pyramid</Button>
                        </Stack>
                        <Stack direction="row" spacing={3}>
                            <TextField
                                label="Participants"
                                onChange={(event: any) => setNumOfParticipants(Number(event.target.value))}
                                type="number"
                                value={numOfParticipants}
                            />
                            <TextField
                                label="% Distributions"
                                onChange={(event: any) => setPercentDistributions(Number(event.target.value))}
                                type="number"
                                value={percentDistributions}
                            />
                        </Stack>
                    </Stack>
                </Paper>
            </Stack>
        </Stack>
    );
};

export default ThePyramid;
