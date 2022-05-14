import { Button, CircularProgress } from "@mui/material";
import React, { useEffect, useState } from "react";
import Tree from "react-d3-tree";
import { RawNodeDatum } from "react-d3-tree/lib/types/common";
import { uniqueNamesGenerator, names } from "unique-names-generator";
import { nth, remove } from "lodash";
import useInterval from "../../hooks/useInterval";
import { useTimer } from "react-timer-hook";
import Progress from "./Progress";

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

const LEFT = 0;
const CENTER = 1;
const RIGHT = 2;
const CHILDREN_SIZE = 3;
const CYCLE_INCOME = 500;
const INTERVAL_TIME = 5;
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
    const [orgChart, setOrgChart] = useState<Pyramid>();

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
        setTimeout(() => {
            restartInterval();
        }, CYCLE_INCOME);
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

        if (clonedPyramid.name.toLowerCase() === "lurleen") {
            console.debug("Check this person");
        }

        // clonedPyramid.children?.forEach((child) => {
        const children = clonedPyramid.children as TreeNode[];
        if (children && children.length > 0) {
            childrensIncome += seeIfChildShouldSetIncome(children, LEFT);
            childrensIncome += seeIfChildShouldSetIncome(children, CENTER);
            childrensIncome += seeIfChildShouldSetIncome(children, RIGHT);

            clonedPyramid.children = children;
        }

        clonedPyramid.attributes.income += CYCLE_INCOME + (childrensIncome * (PERCENT_TO_OWNER / 100));
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

    function initializeChildren(children: TreeNode[] | undefined) {
        const newChildren: TreeNode[] = [];
        if (children?.length !== CHILDREN_SIZE) {
            // newChildren.push({
            //     name: "",
            //     attributes: getDefaultAttributes(),
            // });
            // newChildren.push({
            //     name: "",
            //     attributes: getDefaultAttributes(),
            // });
            // newChildren.push({
            //     name: "",
            //     attributes: getDefaultAttributes(),
            // });

            return newChildren;
        } else {
            return children;
        }
    }

    function addPersonToTree(person: TreeNode, pyramid: TreeNode | Pyramid) {
        const random = Math.floor(Math.random() * 11);
        const left = random < 4;
        const middle = random >= 4 && random < 7;

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
        } else if (middle) {
            if (!centerFull) {
                pyramid.children[CENTER] = person;
            } else if (!centerFull) {
                pyramid.children[LEFT] = person;
            } else if (!leftFull) {
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

    useEffect(() => {
        const numOfPeople = 152;
        const initialOrg: Pyramid = {
            name: "First Org",
            attributes: {
                income: 0,
                money: 0,
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
    }, []);

    return (
        <>
            <Progress duration={INTERVAL_TIME} timeLeft={seconds} text="test" />
            <div id="treeWrapper" style={{ width: "100%", height: "60vh" }}>
                {orgChart && orgChart?.children?.length > 0 ? (
                    <Tree data={orgChart as Pyramid} orientation="vertical" />
                ) : (
                    <CircularProgress />
                )}
            </div>
            {isRunning ? <Button onClick={pause}>Pause</Button> : <Button onClick={resume}>Resume</Button>}
        </>
    );
};

export default ThePyramid;
